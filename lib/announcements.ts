import { supabase } from "@/lib/supabase";
import type { Announcement } from "@/lib/types";

const announcementBucket =
  process.env.NEXT_PUBLIC_SUPABASE_ANNOUNCEMENT_BUCKET ?? "announcement-files";

type FetchAnnouncementsOptions = {
  limit?: number;
};

export async function fetchAnnouncements(options: FetchAnnouncementsOptions = {}) {
  let query = supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Announcement[];
}

export async function fetchAnnouncementSummary() {
  const { data, error } = await supabase.from("announcements").select("is_published");

  if (error) throw error;

  return (data ?? []).reduce(
    (summary, announcement) => {
      summary.total += 1;
      if (announcement.is_published) summary.published += 1;

      return summary;
    },
    { published: 0, total: 0 }
  );
}

export async function createAnnouncement(input: {
  title: string;
  content: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  isPublished?: boolean;
}) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("announcements").insert({
    title: input.title.trim(),
    content: input.content.trim(),
    thumbnail_url: input.thumbnailUrl?.trim() ?? "",
    image_urls: input.imageUrls ?? [],
    is_published: input.isPublished ?? true,
    created_by: user?.id,
    created_by_name: user?.email?.split("@")[0] ?? "Barangay Admin"
  });

  if (error) throw error;
}

export async function updateAnnouncement(input: {
  id: string;
  title: string;
  content: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  isPublished: boolean;
}) {
  const { error } = await supabase
    .from("announcements")
    .update({
      title: input.title.trim(),
      content: input.content.trim(),
      thumbnail_url: input.thumbnailUrl?.trim() ?? "",
      image_urls: input.imageUrls ?? [],
      is_published: input.isPublished,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.id);

  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);

  if (error) throw error;
}

export async function fetchAuthorNamesByIds(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));

  if (uniqueIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  if (error) throw error;

  return new Map(
    (data ?? [])
      .filter((row) => row.id && row.full_name)
      .map((row) => [row.id as string, row.full_name as string])
  );
}

export async function uploadAnnouncementImage(file: File, folder: "gallery" | "thumbnails") {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  const fileName = `${Date.now()}_${safeName || "announcement"}.${extension}`;
  const storagePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from(announcementBucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false
  });

  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? `Create the ${announcementBucket} storage bucket first.`
        : error.message
    );
  }

  const { data } = supabase.storage.from(announcementBucket).getPublicUrl(storagePath);
  return data.publicUrl;
}
