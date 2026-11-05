import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSessionCookieName, getActiveSignedAdminSession } from "@/lib/admin-session";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export const dynamic="force-dynamic";

const bucket = "office-profile-photos";
const maxBytes = 2 * 1024 * 1024;
async function context(request: NextRequest) {
  const session = await getActiveSignedAdminSession(request.cookies.get(adminSessionCookieName)?.value ?? "");
  if (!session) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {session,url,key,client:createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),path:`${session.userId}/avatar`};
}
export async function GET(request:NextRequest) {
  const ctx=await context(request);
  if(!ctx)return new NextResponse(null,{status:401});
  const target=request.nextUrl.searchParams.get('userId');
  let path=ctx.path;
  if(target&&target!==ctx.session.userId){
    if(ctx.session.role!=='admin')return new NextResponse(null,{status:403,headers:{'Cache-Control':'no-store'}});
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target))return new NextResponse(null,{status:400});
    const {data:account,error:lookupError}=await ctx.client.from('profiles').select('id').eq('id',target).in('role',['admin','staff']).maybeSingle();
    if(lookupError)return new NextResponse(null,{status:503,headers:{'Cache-Control':'no-store'}});
    if(!account)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
    path=target+'/avatar';
  }
  // The browser URL version alone cannot invalidate a cached storage response.
  const photoUrl=new URL(ctx.url+'/storage/v1/object/authenticated/'+bucket+'/'+path);
  photoUrl.searchParams.set('cacheNonce',crypto.randomUUID());
  const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
  try {
    const response=await fetch(photoUrl,{headers:{apikey:ctx.key,Authorization:'Bearer '+ctx.key},cache:'no-store'});
    if(!response.ok)return new NextResponse(null,{status:response.status===404||response.status===400?404:503,headers});
    return new NextResponse(await response.blob(),{headers:{...headers,'Content-Type':response.headers.get('content-type')||'application/octet-stream'}});
  } catch {
    return new NextResponse(null,{status:503,headers});
  }
}
export async function POST(request:NextRequest) {
  const rejected=rejectCrossOriginMutation(request); if(rejected)return rejected;
  const ctx=await context(request);
  if(!ctx)return NextResponse.json({message:"Please sign in again."},{status:401});
  if(Number(request.headers.get("content-length"))>maxBytes+65536)return NextResponse.json({message:"Choose an image under 2 MB."},{status:413});
  const form=await request.formData().catch(()=>null);
  const file=form?.get("file");
  if(!(file instanceof File) || file.size===0 || file.size>maxBytes)return NextResponse.json({message:"Choose a JPG, PNG or WebP image under 2 MB."},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const png=bytes.slice(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index]) && bytes.length>=24;
  const jpg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const webp=String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  const type=png?"image/png":jpg?"image/jpeg":webp?"image/webp":"";
  if(!type || type!==file.type)return NextResponse.json({message:"Choose a valid JPG, PNG or WebP image."},{status:400});
  const {data:existing}=await ctx.client.storage.getBucket(bucket);
  if(!existing) {
    const {error}=await ctx.client.storage.createBucket(bucket,{public:false,fileSizeLimit:maxBytes,allowedMimeTypes:["image/jpeg","image/png","image/webp"]});
    if(error && !(await ctx.client.storage.getBucket(bucket)).data)return NextResponse.json({message:"Photo storage is unavailable. Please try again."},{status:503});
  }
  const {error}=await ctx.client.storage.from(bucket).upload(ctx.path,bytes,{contentType:type,upsert:true,cacheControl:"0"});
  if(error)return NextResponse.json({message:"Unable to save your photo. Please try again."},{status:500});
  return NextResponse.json({ok:true});
}
export async function DELETE(request:NextRequest) {
  const rejected=rejectCrossOriginMutation(request);if(rejected)return rejected;
  const ctx=await context(request);
  if(!ctx)return NextResponse.json({message:"Please sign in again."},{status:401});
  const {error}=await ctx.client.storage.from(bucket).remove([ctx.path]);
  if(error)return NextResponse.json({message:"Unable to remove your photo. Please try again."},{status:500});
  return NextResponse.json({ok:true});
}
