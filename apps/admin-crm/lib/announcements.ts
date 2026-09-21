import { supabase } from "@/lib/supabase";
import type { Announcement } from "@/lib/types";
import DOMPurify from "dompurify";

const announcementSanitizeConfig = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "p", "div", "ul", "ol", "li", "span", "font"],
  ALLOWED_ATTR: ["color"],
  ALLOW_DATA_ATTR: false
};

export function sanitizeAnnouncementHtml(content: string) {
  return DOMPurify.sanitize(content, announcementSanitizeConfig);
}

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

  const imageUrls = normalizeImageUrls(input.imageUrls ?? []);
  const thumbnailUrl = normalizeImageUrl(input.thumbnailUrl);

  const { error } = await supabase.from("announcements").insert({
    title: input.title.trim(),
    content: sanitizeAnnouncementHtml(input.content.trim()),
    thumbnail_url: thumbnailUrl,
    image_urls: imageUrls,
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
  const imageUrls = normalizeImageUrls(input.imageUrls ?? []);
  const thumbnailUrl = normalizeImageUrl(input.thumbnailUrl);

  const { error } = await supabase
    .from("announcements")
    .update({
      title: input.title.trim(),
      content: sanitizeAnnouncementHtml(input.content.trim()),
      thumbnail_url: thumbnailUrl,
      image_urls: imageUrls,
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
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!allowedTypes.has(file.type)) {
    throw new Error("Only JPEG, PNG, and WebP images can be uploaded.");
  }

  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("Images must be larger than 0 bytes and no bigger than 5 MB.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/admin/announcements/upload", {
    method: "POST",
    body: formData
  });

  const body = (await response.json().catch(() => null)) as {
    message?: string;
    url?: string;
  } | null;

  if (!response.ok || !body?.url) {
    throw new Error(body?.message ?? "Unable to upload announcement image.");
  }

  return body.url;
}

function normalizeImageUrls(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeImageUrl(value)).filter(Boolean))
  );
}

function normalizeImageUrl(value?: string) {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) return "";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue, window.location.origin);
  } catch {
    throw new Error("Image URLs must be valid HTTP(S) URLs.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Image URLs must use HTTP or HTTPS.");
  }

  return parsedUrl.href;
}
