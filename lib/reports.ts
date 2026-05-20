import { supabase } from "@/lib/supabase";
import { normalizeReportStatus } from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";

type FetchReportsOptions = {
  limit?: number;
};

export async function fetchReports(options: FetchReportsOptions = {}) {
  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as CommunityReport[];
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter(Boolean) as string[])
  );
  const nameByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: residents } = await supabase
      .from("residents")
      .select("id, full_name")
      .in("id", userIds);

    residents?.forEach((resident) => {
      if (resident.id && resident.full_name) {
        nameByUserId.set(resident.id, resident.full_name);
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

  return rows.map((row) => ({
    ...row,
    reporter_name: row.user_id
      ? nameByUserId.get(row.user_id) ?? "Unknown resident"
      : "Unknown resident"
  }));
}

export async function fetchReportSummary() {
  const { data, error } = await supabase.from("reports").select("status, latitude, longitude");

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
  }>;

  return rows.reduce(
    (summary, report) => {
      const status = normalizeReportStatus(report.status ?? undefined);
      summary.total += 1;
      if (status === "pending") summary.pending += 1;
      if (status === "in progress") summary.progress += 1;
      if (status === "resolved") summary.resolved += 1;
      if (typeof report.latitude === "number" && typeof report.longitude === "number") {
        summary.mapped += 1;
      }

      return summary;
    },
    { mapped: 0, pending: 0, progress: 0, resolved: 0, total: 0 }
  );
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
