import { supabase } from "@/lib/supabase";
import { fetchResidents } from "@/lib/residents";
import { residentAccess } from "@/lib/resident-state";
import { notificationReadKey, readNotificationIds, unreadNotificationIds, type NotificationKind } from "@/lib/notification-read-state";

export const notificationReadEvent = "bc-office-notification-read";
const project = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured";
const memoryReads = new Map<string, Set<string>>();
export type PendingNotificationIds = Record<NotificationKind, string[]>;

export function unreadIds(kind: NotificationKind, ids: string[], userId: string) {
  if (!userId) return [];
  const key = notificationReadKey(project, userId, kind);
  let seen = memoryReads.get(key) ?? new Set<string>();
  try {
    seen = new Set([...seen, ...readNotificationIds(window.localStorage, key)]);
  } catch {
    // Storage may be disabled. Reads still clear for this session.
  }
  return unreadNotificationIds(ids, seen);
}

export async function markOfficeNotificationRead(kind: NotificationKind, id: string) {
  if (!id) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user.id) return;
  const userId = session.user.id;
  const key = notificationReadKey(project, userId, kind);
  const seen = new Set(memoryReads.get(key));
  try {
    for (const stored of readNotificationIds(window.localStorage, key)) seen.add(stored);
  } catch { /* In-memory fallback below. */ }
  seen.add(id);
  memoryReads.set(key, seen);
  try {
    window.localStorage.setItem(key, JSON.stringify([...seen]));
  } catch {
    console.warn("Notification read history could not be saved in this browser.");
  }
  window.dispatchEvent(new Event(notificationReadEvent));
}

async function pendingIds(table: "reports" | "document_requests") {
  const ids: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table).select("id").eq("status", "pending").order("id").range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    ids.push(...rows.map(row => String(row.id)));
    if (rows.length < pageSize) return ids;
  }
}

async function pendingResidentIds() {
  const ids: string[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase.rpc("get_resident_directory", {
      p_search: "", p_access: "legacy_pending", p_phone: "all", p_page: page, p_page_size: 25,
    });
    if (error?.code === "PGRST202") {
      return (await fetchResidents({ images: false })).filter(row => residentAccess(row) === "legacy_pending").map(row => row.id);
    }
    if (error) throw error;
    ids.push(...(data.items as { id: string }[]).map(row => row.id));
    if (ids.length >= data.filteredTotal || data.items.length === 0) return ids;
  }
}

export async function fetchPendingNotificationIds(): Promise<PendingNotificationIds> {
  const [reports, documents, residents] = await Promise.all([
    pendingIds("reports"), pendingIds("document_requests"), pendingResidentIds(),
  ]);
  return { reports, documents, residents };
}
