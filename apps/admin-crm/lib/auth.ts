import { supabase } from "@/lib/supabase";
import { isOfficeRole, type OfficeRole } from "@/lib/roles";

export async function signInAsOfficeUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password;

  if (!normalizedEmail || !normalizedPassword) {
    return { ok: false, message: "Email and password are required." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Unable to sign in." };
  }

  return { ok: true, message: "Signed in successfully." };
}

export async function createAdminServerSession(expectedRole: OfficeRole) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim() ?? "";
  if (!accessToken) {
    return { ok: false, message: "No active session found." };
  }

  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, expectedRole }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      ok: false,
      message: payload?.message ?? "Unable to create admin session.",
    };
  }

  return { ok: true, message: "Admin session created." };
}

export async function getAdminServerSession() {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as {
    role?: string;
    userId?: string;
  } | null;

  const role = payload?.role?.toLowerCase().trim();
  return isOfficeRole(role) && payload?.userId
    ? { role, userId: payload.userId }
    : null;
}

export async function clearAdminServerSession() {
  await fetch("/api/admin/session", {
    method: "DELETE",
  }).catch(() => undefined);
}
