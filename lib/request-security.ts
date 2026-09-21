import { NextRequest, NextResponse } from "next/server";

export function rejectCrossOriginMutation(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) return null;

  try {
    if (new URL(origin).origin === request.nextUrl.origin) return null;
  } catch {
    // Treat malformed Origin headers as untrusted.
  }

  return NextResponse.json(
    { message: "Cross-origin requests are not allowed." },
    { status: 403 }
  );
}
