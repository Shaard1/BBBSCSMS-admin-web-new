import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieName,
  createSignedAdminSession,
  getSignedAdminSession,
  getVerifiedOfficeUser
} from "@/lib/admin-session";
import { isOfficeRole, type OfficeRole } from "@/lib/roles";

const adminCookieMaxAgeSeconds = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const adminSession = await getSignedAdminSession(adminSessionToken);

  if (!adminSession) {
    return NextResponse.json(
      { message: "No active admin session." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    role: adminSession.role,
    userId: adminSession.userId
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    accessToken?: string;
    expectedRole?: string;
  } | null;
  const accessToken = payload?.accessToken?.trim() ?? "";
  const expectedRole = normalizeOfficeRole(payload?.expectedRole);

  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing access token." },
      { status: 400 }
    );
  }

  if (!expectedRole) {
    return NextResponse.json(
      { message: "Invalid login mode." },
      { status: 400 }
    );
  }

  const officeUser = await getVerifiedOfficeUser(accessToken);

  if (!officeUser) {
    return NextResponse.json(
      { message: "Only staff or admin accounts can access this web portal." },
      { status: 403 }
    );
  }

  if (!isRoleAllowedForLoginMode(officeUser.role, expectedRole)) {
    return NextResponse.json(
      {
        message:
          expectedRole === "admin"
            ? "Please use an administrator account."
            : "Please use a staff account."
      },
      { status: 403 }
    );
  }

  const sessionToken = await createSignedAdminSession(
    officeUser.userId,
    officeUser.role,
    adminCookieMaxAgeSeconds
  );
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: adminSessionCookieName,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminCookieMaxAgeSeconds
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: adminSessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}

function normalizeOfficeRole(value?: string): OfficeRole | null {
  const role = value?.toLowerCase().trim();
  return isOfficeRole(role) ? role : null;
}

function isRoleAllowedForLoginMode(actualRole: OfficeRole, expectedRole: OfficeRole) {
  if (expectedRole === "admin") return actualRole === "admin";
  return actualRole === "admin" || actualRole === "staff";
}
