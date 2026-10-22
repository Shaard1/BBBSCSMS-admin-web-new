import { supabase } from "@/lib/supabase";
import { resolvePrivateFiles } from "@/lib/private-files";
import type { CommunityReport } from "@/lib/types";

type FetchReportsOptions = {
  limit?: number;
  images?: boolean;
};

export async function fetchReports(options: FetchReportsOptions = {}) {
  let query = supabase
    .from("reports")
    .select<string>(options.images === false ? 'id,user_id,description,category,status,admin_note,latitude,longitude,created_at' : '*')
    .order("created_at", { ascending: false }).returns<CommunityReport[]>();

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as CommunityReport[];
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => row.user_id?.trim())
        .filter((userId): userId is string => typeof userId === "string" && isUuid(userId))
    )
  );
  const nameByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: residents } = await supabase
      .from("residents")
      .select("id, user_id, full_name")
      .or(`id.in.(${userIds.join(",")}),user_id.in.(${userIds.join(",")})`);

    residents?.forEach((resident) => {
      const residentName = resident.full_name?.trim();
      if (!residentName) return;

      if (resident.user_id) {
        nameByUserId.set(resident.user_id, residentName);
      }
      if (resident.id && !nameByUserId.has(resident.id)) {
        nameByUserId.set(resident.id, residentName);
      }
    });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    profiles?.forEach((profile) => {
      if (profile.id && profile.full_name && !nameByUserId.has(profile.id)) {
        nameByUserId.set(profile.id, profile.full_name);
      }
    });
  }

  const records = rows.map((row) => ({
    ...row,
    reporter_name: row.user_id
      ? nameByUserId.get(row.user_id) ?? "Unknown resident"
      : "Unknown resident"
  }));
  return options.images === false ? records : resolvePrivateFiles(records);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function updateReportStatus(reportId: string, status: string) {
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);

  if (error) throw error;
}

export async function updateReportCategory(reportId: string, category: string) {
  const { error } = await supabase
    .from("reports")
    .update({ category })
    .eq("id", reportId);

  if (error) throw error;
}

export async function updateReportAdminNote(reportId: string, adminNote: string) {
  const { error } = await supabase
    .from("reports")
    .update({ admin_note: adminNote.trim() })
    .eq("id", reportId);

  if (error) throw error;
}

export async function deleteReport(reportId: string) {
  const { error } = await supabase.from("reports").delete().eq("id", reportId);

  if (error) throw error;
}
