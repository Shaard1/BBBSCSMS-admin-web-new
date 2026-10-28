import { supabase } from "@/lib/supabase";
export { getAdminServerSession } from "./workspace-session";

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
    return {
      ok: false,
      message: error?.code === "invalid_credentials"
        ? "Email or password is incorrect."
        : error?.code === "over_request_rate_limit"
          ? "Too many sign-in attempts. Please wait and try again."
          : "Unable to sign in. Check your connection and try again.",
    };
  }

  return { ok: true, message: "Signed in successfully." };
}

export async function createAdminServerSession() {
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
    body: JSON.stringify({ accessToken }),
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

export async function clearAdminServerSession() {
  await fetch("/api/admin/session", {
    method: "DELETE",
  }).catch(() => undefined);
}
