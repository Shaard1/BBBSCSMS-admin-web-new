export const reportCategoryOptions = [
  "Road Damage",
  "Garbage Collection",
  "Broken Streetlight",
  "Drainage Issue",
  "Noise Complaint",
  "Others"
] as const;

export function normalizeReportStatus(value?: string) {
  const status = value?.toLowerCase().trim();
  if (status === "in_process" || status === "in progress") return "in progress";
  if (status === "resolved" || status === "completed") return "resolved";
  return "pending";
}

export function reportStatusLabel(status: string) {
  if (status === "in progress") return "In Progress";
  if (status === "resolved") return "Resolved";
  return "Pending";
}

export function normalizeReportCategory(value?: string) {
  const raw = value?.trim() ?? "";
  const normalized = raw.toLowerCase();

  if (normalized === "other") return "Others";
  if (normalized === "garbage") return "Garbage Collection";
  if (normalized === "noise") return "Noise Complaint";
  if (normalized === "flooding") return "Drainage Issue";

  return reportCategoryOptions.includes(raw as (typeof reportCategoryOptions)[number])
    ? raw
    : "Others";
}

export function shortReportCategory(value?: string) {
  const category = normalizeReportCategory(value);
  if (category === "Garbage Collection") return "Garbage";
  if (category === "Broken Streetlight") return "Streetlight";
  if (category === "Drainage Issue") return "Drainage";
  if (category === "Noise Complaint") return "Noise";
  return category;
}
