import { supabase } from "@/lib/supabase";
import type { Resident } from "@/lib/types";

type FetchResidentsOptions = {
  limit?: number;
};

export async function fetchResidents(options: FetchResidentsOptions = {}) {
  let query = supabase
    .from("residents")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Resident[];
}

export async function fetchResidentSummary() {
  const { data, error } = await supabase.from("residents").select("status");

  if (error) throw error;

  return (data ?? []).reduce(
    (summary, resident) => {
      summary.total += 1;
      if (resident.status === "pending") summary.pending += 1;

      return summary;
    },
    { pending: 0, total: 0 }
  );
}

export async function approveResident(id: string) {
  const { error } = await supabase
    .from("residents")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", id);

  if (error) throw error;

  const { data: resident, error: residentError } = await supabase
    .from("residents")
    .select("id, full_name")
    .eq("id", id)
    .single();

  if (residentError || !resident) {
    return {
      approved: true,
      profileSynced: false,
      warning:
        "Resident approved, but profile sync failed. Verify profile permissions."
    };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: resident.id,
    full_name: resident.full_name ?? "",
    role: "resident"
  });

  if (profileError) {
    return {
      approved: true,
      profileSynced: false,
      warning:
        "Resident approved, but profile sync failed. Verify profile permissions."
    };
  }

  return { approved: true, profileSynced: true };
}

export async function rejectResident(id: string, reason: string) {
  const { error } = await supabase
    .from("residents")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id);

  if (error) throw error;
}
