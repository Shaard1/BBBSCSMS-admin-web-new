import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSessionCookieName, getActiveSignedAdminSession } from "@/lib/admin-session";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export async function PATCH(request: NextRequest) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const session = await getActiveSignedAdminSession(request.cookies.get(adminSessionCookieName)?.value ?? "");
  if (!session) return NextResponse.json({message:"Please sign in again."},{status:401});
  const payload = await request.json().catch(() => null);
  const fullName = typeof payload?.fullName === "string" ? payload.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 120) return NextResponse.json({message:"Enter a name between 2 and 120 characters."},{status:400});
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({message:"Profile updates are unavailable."},{status:503});
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  // The target and writable fields come from the server, never from the request.
  const {data,error} = await client.from("profiles").update({full_name:fullName}).eq("id",session.userId).select("full_name").single();
  if (error || !data) return NextResponse.json({message:"Unable to save your profile. Please try again."},{status:500});
  return NextResponse.json({fullName:data.full_name});
}
