import { supabase } from "@/lib/supabase";
import { isOfficeRole, type OfficeRole } from "@/lib/roles";

export async function signInAsOfficeUser(
  email: string,
  password: string,
  expectedRole: OfficeRole
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Unable to sign in." };
  }

  const role = await getCurrentOfficeRole();

  if (!role) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Only staff or admin accounts can access this web portal."
    };
  }

  const roleAllowed =
    expectedRole === "staff"
      ? role === "staff" || role === "admin"
      : role === "admin";

  if (!roleAllowed) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        expectedRole === "admin"
          ? "Please use an administrator account."
          : "Please use a staff account."
    };
  }

  return { ok: true, message: "Signed in successfully." };
}

export async function getCurrentOfficeRole() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return null;

  const role = data?.role?.toLowerCase().trim();
  return isOfficeRole(role) ? role : null;
}

export async function createAdminServerSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim() ?? "";
  if (!accessToken) {
    return { ok: false, message: "No active session found." };
  }

  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      ok: false,
      message: payload?.message ?? "Unable to create admin session."
    };
  }

  return { ok: true, message: "Admin session created." };
}

export async function clearAdminServerSession() {
  await fetch("/api/admin/session", {
    method: "DELETE"
  }).catch(() => undefined);
}
