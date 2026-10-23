import { test, expect } from "@playwright/test";
import { notificationReadKey, readNotificationIds, unreadNotificationIds } from "../lib/notification-read-state";

test("a new ID is unread even when the pending count has not changed", () => {
  expect(unreadNotificationIds(["replacement"], new Set(["old"]))).toEqual(["replacement"]);
  expect(unreadNotificationIds(["old", "replacement", "replacement"], new Set(["old"]))).toEqual(["replacement"]);
});

test("read keys isolate project, staff account and notification category", () => {
  const key = notificationReadKey("test", "admin", "documents");
  expect(key).not.toBe(notificationReadKey("test", "staff", "documents"));
  expect(key).not.toBe(notificationReadKey("production", "admin", "documents"));
  expect(key).not.toBe(notificationReadKey("test", "admin", "reports"));
});

test("stored IDs survive reload and malformed storage cannot mark new items read", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  storage.setItem("read", JSON.stringify(["opened", 2, null]));
  expect(unreadNotificationIds(["opened", "new"], readNotificationIds(storage, "read"))).toEqual(["new"]);
  storage.setItem("read", "broken JSON");
  expect([...readNotificationIds(storage, "read")]).toEqual([]);
});
