import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  adminSessionCookieName,
  getActiveSignedAdminSession
} from "@/lib/admin-session";
import { rejectCrossOriginMutation } from "@/lib/request-security";

type CreateStaffPayload = {
  email?: string;
  fullName?: string;
  password?: string;
};

type DeleteStaffPayload = {
  userId?: string;
};

export async function POST(request: NextRequest) {
  const crossOriginResponse = rejectCrossOriginMutation(request);
  if (crossOriginResponse) return crossOriginResponse;

  const adminClient = await getAdminClientForAdminRequest(request);

  if ("error" in adminClient) {
    return adminClient.error;
  }

  const client = adminClient.client;
  const payload = (await request.json().catch(() => null)) as CreateStaffPayload | null;
  const email = payload?.email?.trim().toLowerCase() ?? "";
  const fullName = payload?.fullName?.trim() ?? "";
  const password = payload?.password?.trim() ?? "";

  if (
    !isValidEmail(email) ||
    fullName.length < 2 ||
    fullName.length > 120 ||
    password.length < 8 ||
    password.length > 128
  ) {
    return NextResponse.json(
      { message: "Enter a valid email, a 2-120 character name, and an 8-128 character password." },
      { status: 400 }
    );
  }

  const { data: createdUser, error: createUserError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "staff"
    }
  });

  if (createUserError || !createdUser.user?.id) {
    return NextResponse.json(
      { message: createUserError?.message ?? "Unable to create staff account." },
      { status: 400 }
    );
  }

  const userId = createdUser.user.id;
  const { error: profileError } = await client.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role: "staff",
    status: "approved"
  });

  if (profileError) {
    await client.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json(
      { message: "Staff account created, but role assignment failed. The account was rolled back." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, userId });
}

export async function DELETE(request: NextRequest) {
  const crossOriginResponse = rejectCrossOriginMutation(request);
  if (crossOriginResponse) return crossOriginResponse;

  const adminClient = await getAdminClientForAdminRequest(request);

  if ("error" in adminClient) {
    return adminClient.error;
  }

  const client = adminClient.client;
  const payload = (await request.json().catch(() => null)) as DeleteStaffPayload | null;
  const userId = payload?.userId?.trim() ?? "";

  if (!isUuid(userId)) {
    return NextResponse.json(
      { message: "Invalid office account id." },
      { status: 400 }
    );
  }

  if (userId === adminClient.session.userId) {
    return NextResponse.json(
      { message: "You cannot delete the administrator account currently in use." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileLookupError } = await client
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileLookupError) {
    return NextResponse.json(
      { message: "Unable to verify the office account." },
      { status: 400 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { message: "Office account not found." },
      { status: 404 }
    );
  }

  if (profile.role === "admin") {
    const { count, error: adminCountError } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (adminCountError) {
      return NextResponse.json(
        { message: "Unable to verify administrator count." },
        { status: 400 }
      );
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { message: "At least one administrator account must remain assigned." },
        { status: 400 }
      );
    }
  }

  const { error: deleteAuthUserError } = await client.auth.admin.deleteUser(userId);

  if (deleteAuthUserError) {
    return NextResponse.json(
      { message: deleteAuthUserError.message || "Unable to delete office account." },
      { status: 400 }
    );
  }

  const { error: deleteProfileError } = await client
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (deleteProfileError) {
    return NextResponse.json(
      { message: "Office login was removed, but the profile row could not be deleted." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getAdminClientForAdminRequest(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const session = await getActiveSignedAdminSession(adminSessionToken);

  if (session?.role !== "admin") {
    return {
      error: NextResponse.json(
        { message: "Only administrators can manage staff accounts." },
        { status: 403 }
      )
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        { message: "Missing server configuration for staff account provisioning." },
        { status: 500 }
      )
    };
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }),
    session
  };
}
