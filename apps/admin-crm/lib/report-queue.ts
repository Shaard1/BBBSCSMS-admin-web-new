import type { CommunityReport } from './types';
import { normalizeReportCategory, normalizeReportStatus } from './report-utils';

export const reportPageSize = 25;
export type ReportQueueFilters = {
  search: string;
  status: string;
  category: string;
  sort: string;
  page: number;
};
export type ReportQueueResult = {
  items: CommunityReport[];
  filteredTotal: number;
  summary: { total: number; pending: number; progress: number; resolved: number };
  serverPaged: boolean;
  compatibilityRecords?: CommunityReport[];
};

export function readReportQueueResult(value: unknown): Omit<ReportQueueResult, 'serverPaged'> {
  if (!value || typeof value !== 'object') throw new Error('Invalid report queue response.');
  const result = value as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown> | undefined;
  const isCount = (count: unknown): count is number => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  if (!Array.isArray(result.items) || result.items.length > reportPageSize ||
    !isCount(result.filteredTotal) || !summary ||
    !['total', 'pending', 'progress', 'resolved'].every(key => isCount(summary[key])) ||
    result.items.some(item => !item || typeof item.id !== 'string' || typeof item.created_at !== 'string')) {
    throw new Error('Invalid report queue response.');
  }
  if (result.filteredTotal > (summary.total as number) || result.items.length > result.filteredTotal ||
    (summary.pending as number) + (summary.progress as number) + (summary.resolved as number) !== summary.total) {
    throw new Error('Inconsistent report queue totals.');
  }
  return {
    items: result.items as CommunityReport[],
    filteredTotal: result.filteredTotal,
    summary: summary as ReportQueueResult['summary'],
  };
}

/** Compatibility for projects that have not installed the additive queue migration. */
export function pageLoadedReports(records: CommunityReport[], filters: ReportQueueFilters): ReportQueueResult {
  const query = filters.search.trim().toLowerCase();
  const items = records.filter(report =>
    (filters.status === 'all' || normalizeReportStatus(report.status) === filters.status) &&
    (filters.category === 'all' || normalizeReportCategory(report.category) === filters.category) &&
    (!query || [report.description, report.reporter_name, report.category, report.status].join(' ').toLowerCase().includes(query))
  ).sort((a, b) => {
    const dates = Date.parse(a.created_at) - Date.parse(b.created_at);
    return (filters.sort === 'oldest' ? dates : -dates) || a.id.localeCompare(b.id);
  });
  return {
    items: items.slice(filters.page * reportPageSize, (filters.page + 1) * reportPageSize),
    filteredTotal: items.length,
    summary: {
      total: records.length,
      pending: records.filter(r => normalizeReportStatus(r.status) === 'pending').length,
      progress: records.filter(r => normalizeReportStatus(r.status) === 'in progress').length,
      resolved: records.filter(r => normalizeReportStatus(r.status) === 'resolved').length,
    },
    serverPaged: false,
  };
}
