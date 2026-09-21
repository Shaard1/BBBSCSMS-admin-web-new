import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  adminSessionCookieName,
  getActiveSignedAdminSession
} from "@/lib/admin-session";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export const runtime = "nodejs";

const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

export async function POST(request: NextRequest) {
  const crossOriginResponse = rejectCrossOriginMutation(request);
  if (crossOriginResponse) return crossOriginResponse;

  const sessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const session = await getActiveSignedAdminSession(sessionToken);

  if (!session) {
    return NextResponse.json({ message: "Admin authentication is required." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxImageBytes + 256 * 1024) {
    return NextResponse.json({ message: "The upload is too large." }, { status: 413 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_ANNOUNCEMENT_BUCKET?.trim() || "announcement-files";

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { message: "Missing server configuration for announcement uploads." },
      { status: 500 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const folder = formData?.get("folder");

  if (!(file instanceof File) || !isUploadFolder(folder ?? null)) {
    return NextResponse.json({ message: "A valid image upload is required." }, { status: 400 });
  }

  const extension = allowedImageTypes[file.type as keyof typeof allowedImageTypes];

  if (!extension) {
    return NextResponse.json(
      { message: "Only JPEG, PNG, and WebP images are allowed." },
      { status: 400 }
    );
  }

  if (file.size <= 0 || file.size > maxImageBytes) {
    return NextResponse.json(
      { message: "Images must be larger than 0 bytes and no bigger than 5 MB." },
      { status: 400 }
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const storagePath = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });

  if (error) {
    return NextResponse.json(
      { message: error.message.includes("Bucket not found") ? `Create the ${bucket} storage bucket first.` : error.message },
      { status: 400 }
    );
  }

  const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}

function isUploadFolder(value: FormDataEntryValue | null): value is "gallery" | "thumbnails" {
  return value === "gallery" || value === "thumbnails";
}
