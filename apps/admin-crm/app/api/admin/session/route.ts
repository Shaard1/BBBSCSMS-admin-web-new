import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieName,
  createSignedAdminSession,
  getActiveSignedAdminSession,
  getVerifiedOfficeUser
} from "../../../../lib/admin-session";
import { rejectCrossOriginMutation } from "../../../../lib/request-security";

const adminCookieMaxAgeSeconds = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  let adminSession;
  try {
    adminSession = await getActiveSignedAdminSession(adminSessionToken, true);
  } catch {
    return NextResponse.json(
      { message: "Office access verification is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!adminSession) {
    return NextResponse.json(
      { message: "No active admin session." },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      role: adminSession.role,
      userId: adminSession.userId
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const crossOriginResponse = rejectCrossOriginMutation(request);
  if (crossOriginResponse) return crossOriginResponse;

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

export async function DELETE(request: NextRequest) {
  const crossOriginResponse = rejectCrossOriginMutation(request);
  if (crossOriginResponse) return crossOriginResponse;

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
