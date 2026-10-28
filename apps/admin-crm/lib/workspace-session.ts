import { isOfficeRole } from "./roles";

export async function getAdminServerSession(signal?: AbortSignal) {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Workspace access check unavailable.");

  const payload = (await response.json()) as { role?: unknown; userId?: unknown };
  const role = typeof payload?.role === "string" ? payload.role.toLowerCase().trim() : "";
  if (!isOfficeRole(role) || typeof payload?.userId !== "string" || !payload.userId.trim()) {
    throw new Error("Invalid workspace access response.");
  }
  return { role, userId: payload.userId };
}
