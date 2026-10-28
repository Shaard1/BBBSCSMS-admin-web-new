import { supabase } from "@/lib/supabase";
import { resolvePrivateFiles } from "@/lib/private-files";
import type { CommunityReport } from "@/lib/types";
import { pageLoadedReports, readReportQueueResult, reportPageSize, type ReportQueueFilters, type ReportQueueResult } from './report-queue';

export async function fetchReportQueue(filters: ReportQueueFilters, signal?: AbortSignal, loadedReports?: CommunityReport[]): Promise<ReportQueueResult> {
  // Reuse the current page's in-memory snapshot in compatibility mode, like the original list.
  // Refresh and mutations discard it; it never persists or crosses component/account lifetimes.
  if (loadedReports) return { ...pageLoadedReports(loadedReports, filters), compatibilityRecords: loadedReports };
  let request = supabase.rpc('get_report_queue', {
    p_search: filters.search.trim(), p_status: filters.status, p_category: filters.category,
    p_sort: filters.sort, p_page: filters.page, p_page_size: reportPageSize,
  });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  signal?.throwIfAborted();
  if (error?.code === 'PGRST202') {
    // Existing projects remain usable until their queue migration is installed.
    const records = await fetchReports();
    signal?.throwIfAborted();
    return { ...pageLoadedReports(records, filters), compatibilityRecords: records };
  }
  if (error) throw error;
  const result = readReportQueueResult(data);
  const items = await resolvePrivateFiles(result.items);
  signal?.throwIfAborted();
  return { ...result, items, serverPaged: true };
}

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
