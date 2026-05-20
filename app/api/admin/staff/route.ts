import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSessionCookieName, getSignedOfficeRole } from "@/lib/admin-session";

type CreateStaffPayload = {
  email?: string;
  fullName?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const officeRole = await getSignedOfficeRole(adminSessionToken);

  if (officeRole !== "admin") {
    return NextResponse.json(
      { message: "Only administrators can create staff accounts." },
      { status: 403 }
    );
  }

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { message: "Missing server configuration for staff account provisioning." },
      { status: 500 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (createUserError || !createdUser.user?.id) {
    return NextResponse.json(
      { message: createUserError?.message ?? "Unable to create staff account." },
      { status: 400 }
    );
  }

  const userId = createdUser.user.id;
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    role: "staff"
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json(
      { message: "Staff account created, but role assignment failed. The account was rolled back." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, userId });
}

