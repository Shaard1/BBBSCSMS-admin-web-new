import { supabase } from "@/lib/supabase";

export type OfficeAccount = {
  id: string;
  email?: string;
  full_name: string;
  role: "admin" | "staff";
  status?: string;
};

export async function fetchOfficeAccounts() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .in("role", ["admin", "staff"])
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OfficeAccount[];
}

export async function updateOfficeRole(id: string, role: "admin" | "staff") {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);

  if (error) throw error;
}

export async function createStaffAccount(payload: {
  email: string;
  fullName: string;
  password: string;
}) {
  const response = await fetch("/api/admin/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = (await response.json().catch(() => null)) as {
    message?: string;
    ok?: boolean;
  } | null;

  if (!response.ok || !body?.ok) {
    throw new Error(body?.message ?? "Unable to create staff account.");
  }
}

export async function deleteOfficeAccount(userId: string) {
  const response = await fetch("/api/admin/staff", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });

  const body = (await response.json().catch(() => null)) as {
    message?: string;
    ok?: boolean;
  } | null;

  if (!response.ok || !body?.ok) {
    throw new Error(body?.message ?? "Unable to delete office account.");
  }
}
