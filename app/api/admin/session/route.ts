import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieName,
  createSignedAdminSession,
  getVerifiedOfficeUser
} from "@/lib/admin-session";

const adminCookieMaxAgeSeconds = 60 * 60 * 24;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    accessToken?: string;
  } | null;
  const accessToken = payload?.accessToken?.trim() ?? "";

  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing access token." },
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
