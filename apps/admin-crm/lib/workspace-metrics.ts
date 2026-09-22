import {
  hasValidReportLocation,
  normalizeReportCategory,
  normalizeReportStatus,
} from "./report-utils";
import type { CommunityReport, Resident } from "./types";

export function monthlyActivity(
  reports: CommunityReport[],
  residents: Resident[],
  year: number,
) {
  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    reports: 0,
    residents: 0,
  }));
  for (const [kind, records] of [
    ["reports", reports],
    ["residents", residents],
  ] as const) {
    for (const item of records) {
      const date = new Date(item.created_at);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === year)
        months[date.getMonth()][kind] += 1;
    }
  }
  return months;
}

export function reportSnapshot(reports: CommunityReport[], now = new Date()) {
  const pending = reports.filter(
    (r) => normalizeReportStatus(r.status) === "pending",
  ).length;
  const progress = reports.filter(
    (r) => normalizeReportStatus(r.status) === "in progress",
  ).length;
  const resolved = reports.filter(
    (r) => normalizeReportStatus(r.status) === "resolved",
  ).length;
  const open = reports.filter(
    (r) => normalizeReportStatus(r.status) !== "resolved",
  );
  const overdue = open.filter(
    (r) => now.getTime() - new Date(r.created_at).getTime() >= 7 * 86400000,
  ).length;
  const mapped = reports.filter((r) =>
    hasValidReportLocation(r.latitude, r.longitude),
  ).length;
  const categories = new Map<string, number>();
  reports.forEach((r) => {
    const category = normalizeReportCategory(r.category);
    categories.set(category, (categories.get(category) ?? 0) + 1);
  });
  return {
    pending,
    progress,
    resolved,
    open: open.length,
    overdue,
    mapped,
    unmappedOpen: open.filter(
      (r) => !hasValidReportLocation(r.latitude, r.longitude),
    ).length,
    resolutionRate: reports.length
      ? Math.round((resolved / reports.length) * 100)
      : 0,
    categories: [...categories].sort((a, b) => b[1] - a[1]),
  };
}
