export const notificationPreferenceEvent = "bc-notification-preference";
export function notificationPreferenceKey(userId: string) {
  return `bc:${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "local"}:${userId}:notification-badge`;
}
