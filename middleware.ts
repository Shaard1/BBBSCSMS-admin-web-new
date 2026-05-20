import { NextRequest, NextResponse } from "next/server";
import { adminSessionCookieName, getSignedOfficeRole } from "@/lib/admin-session";
import { canManageOfficeAccounts, canViewAnalytics } from "@/lib/roles";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }

  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const officeRole = await getSignedOfficeRole(adminSessionToken);

  if (!officeRole) {
    const response = NextResponse.redirect(new URL("/admin/login", request.url));
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

  if (pathname.startsWith("/admin/analytics") && !canViewAnalytics(officeRole)) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  if (pathname.startsWith("/admin/staff") && !canManageOfficeAccounts(officeRole)) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
