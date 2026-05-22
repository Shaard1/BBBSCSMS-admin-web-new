import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSessionCookieName, getSignedOfficeRole } from "@/lib/admin-session";

type CreateStaffPayload = {
  email?: string;
  fullName?: string;
  password?: string;
};

type DeleteStaffPayload = {
  userId?: string;
};

export async function POST(request: NextRequest) {
  const adminClient = await getAdminClientForAdminRequest(request);

  if ("error" in adminClient) {
    return adminClient.error;
  }

  const client = adminClient.client;
  const payload = (await request.json().catch(() => null)) as CreateStaffPayload | null;
  const email = payload?.email?.trim().toLowerCase() ?? "";
  const fullName = payload?.fullName?.trim() ?? "";
  const password = payload?.password?.trim() ?? "";

  if (!email || !fullName || password.length < 8) {
    return NextResponse.json(
      { message: "Email, full name, and a password with at least 8 characters are required." },
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
  const adminClient = await getAdminClientForAdminRequest(request);

  if ("error" in adminClient) {
    return adminClient.error;
  }

  const client = adminClient.client;
  const payload = (await request.json().catch(() => null)) as DeleteStaffPayload | null;
  const userId = payload?.userId?.trim() ?? "";

  if (!userId) {
    return NextResponse.json(
      { message: "Missing office account id." },
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

async function getAdminClientForAdminRequest(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const officeRole = await getSignedOfficeRole(adminSessionToken);

  if (officeRole !== "admin") {
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
    })
  };
}
