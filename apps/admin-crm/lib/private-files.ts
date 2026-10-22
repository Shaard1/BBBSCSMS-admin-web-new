import { supabase } from "@/lib/supabase";

const privateBuckets = new Set(["resident-files", "report-images"]);
const imageFields = [
  "id_image", "id_image_front", "id_image_back", "profile_image",
  "profile_image_original", "image_url", "image_urls", "payment_proof_url",
  "identity_evidence_url", "residency_evidence_url", "authorization_evidence_url",
] as const;

type FileResolverOptions = {
  baseUrl?: string;
  sign?: (bucket: string, path: string) => Promise<string>;
};

/** Resolve stored locators at read time. Never persist expiring signed URLs. */
export async function resolvePrivateFiles<T extends object>(
  records: T[], options: FileResolverOptions = {},
): Promise<T[]> {
  const pending = new Map<string, Promise<string>>();
  async function resolve(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) return Promise.all(value.map(resolve));
    if (typeof value !== "string" || !value) return value;
    if (value.trim().startsWith("[")) {
      try {
        const list: unknown = JSON.parse(value);
        if (Array.isArray(list)) return Promise.all(list.map(resolve));
      } catch { /* A non-JSON locator is handled below. */ }
    }
    const configured = options.baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configured) return value;
    const locator = value.startsWith('resident-files/')
      ? `${configured}/storage/v1/object/public/${value}` : value;
    let url: URL;
    try { url = new URL(locator); } catch { return value; }
    if (url.origin !== new URL(configured).origin) return value;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match || !privateBuckets.has(match[1])) return value;
    const bucket = match[1];
    let path: string;
    try { path = decodeURIComponent(match[2]); } catch { return ""; }
    if (path.split("/").some((part) => part === "." || part === "..")) return "";
    const key = `${bucket}/${path}`;
    if (!pending.has(key)) {
      pending.set(key, (async () => {
        try {
          if (options.sign) return await options.sign(bucket, path);
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
          return error ? "" : data?.signedUrl ?? "";
        } catch {
          // Fail closed: never fall back to public access, including network failures.
          return "";
        }
      })());
    }
    return pending.get(key)!;
  }
  return Promise.all(records.map(async (record) => {
    const copy = { ...record } as Record<string, unknown>;
    await Promise.all(imageFields.map(async (field) => {
      if (field in copy) copy[field] = await resolve(copy[field]);
    }));
    return copy as T;
  }));
}
