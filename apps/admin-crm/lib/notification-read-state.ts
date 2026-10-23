export type NotificationKind = "reports" | "documents" | "residents";
export type ReadStorage = Pick<Storage, "getItem" | "setItem">;

export function notificationReadKey(project: string, userId: string, kind: NotificationKind) {
  return ["bc-office-read-v1", project, userId, kind].map(encodeURIComponent).join(":");
}

export function readNotificationIds(storage: ReadStorage, key: string): Set<string> {
  const raw = storage.getItem(key);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function unreadNotificationIds(ids: string[], seen: Set<string>) {
  return [...new Set(ids)].filter(id => !seen.has(id));
}
