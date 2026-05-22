import { supabase } from "@/lib/supabase";
import { canManageOfficeAccounts, type OfficeRole } from "@/lib/roles";

export type GlobalSearchResult = {
  id: string;
  category: "resident" | "report" | "announcement" | "office" | "page";
  href: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone?: "approved" | "pending" | "flagged" | "info";
};

const adminPageResults = [
  {
    id: "page-dashboard",
    category: "page",
    href: "/admin/dashboard",
    title: "Dashboard",
    subtitle: "Open the admin dashboard overview",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["home", "overview", "summary", "main"]
  },
  {
    id: "page-analytics",
    category: "page",
    href: "/admin/analytics",
    title: "Analytics",
    subtitle: "View analytics and reporting insights",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["stats", "statistics", "insights", "charts", "reports"]
  },
  {
    id: "page-staff",
    category: "page",
    href: "/admin/staff",
    title: "Staff Accounts",
    subtitle: "Manage admin and staff office accounts",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["staff", "admin", "accounts", "office", "users"]
  },
  {
    id: "page-reports",
    category: "page",
    href: "/admin/reports",
    title: "Community Reports",
    subtitle: "Review resident-submitted community reports",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["reports", "complaints", "incidents", "cases", "submissions"]
  },
  {
    id: "page-map",
    category: "page",
    href: "/admin/map",
    title: "Complaint Map",
    subtitle: "Open the complaint map and mapped reports",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["map", "complaint", "location", "pins", "mapped", "reports"]
  },
  {
    id: "page-residents",
    category: "page",
    href: "/admin/residents",
    title: "Resident Verification",
    subtitle: "Review and verify resident applications",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["resident", "verification", "verify", "applications", "approval"]
  },
  {
    id: "page-announcements",
    category: "page",
    href: "/admin/announcements",
    title: "Announcement",
    subtitle: "Manage barangay announcements and posts",
    badge: "Page",
    badgeTone: "info" as const,
    keywords: ["announcement", "announcements", "posts", "advisories", "news"]
  }
] satisfies Array<GlobalSearchResult & { keywords: string[] }>;

export async function fetchGlobalSearchResults(query: string, role: OfficeRole) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const likePattern = buildLikePattern(normalizedQuery);
  const pageResults = searchAdminPages(normalizedQuery, role);

  const settledResults = await Promise.allSettled([
    searchResidents(likePattern),
    searchReports(likePattern),
    searchAnnouncements(likePattern),
    canManageOfficeAccounts(role) ? searchOfficeAccounts(likePattern) : Promise.resolve([])
  ]);

  const [residentResults, reportResults, announcementResults, officeResults] = settledResults.map(
    (result) => (result.status === "fulfilled" ? result.value : [])
  );

  return [
    ...pageResults,
    ...residentResults,
    ...reportResults,
    ...announcementResults,
    ...officeResults
  ];
}

function searchAdminPages(query: string, role: OfficeRole): GlobalSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  return adminPageResults
    .filter((result) => {
      if (result.href === "/admin/analytics" && role !== "admin") return false;
      if (result.href === "/admin/staff" && !canManageOfficeAccounts(role)) return false;

      return `${result.title} ${result.subtitle} ${result.keywords.join(" ")}`
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .slice(0, 5);
}

async function searchResidents(likePattern: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from("residents")
    .select("id, full_name, address, contact_number, status")
    .or(
      `full_name.ilike.${likePattern},address.ilike.${likePattern},contact_number.ilike.${likePattern},id.ilike.${likePattern}`
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  return (data ?? []).map((resident) => ({
    id: `resident-${resident.id}`,
    category: "resident",
    href: "/admin/residents",
    title: resident.full_name?.trim() || "Unnamed resident",
    subtitle: resident.address?.trim() || resident.contact_number?.trim() || resident.id,
    badge: normalizeResidentStatus(resident.status),
    badgeTone: normalizeResidentStatusTone(resident.status)
  }));
}

async function searchReports(likePattern: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, description, category, status, user_id")
    .or(
      `description.ilike.${likePattern},category.ilike.${likePattern},status.ilike.${likePattern},id.ilike.${likePattern}`
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  const reportRows = data ?? [];
  const userIds = Array.from(
    new Set(reportRows.map((report) => report.user_id?.trim()).filter(Boolean) as string[])
  );
  const residentNameByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: residents } = await supabase
      .from("residents")
      .select("id, user_id, full_name")
      .or(`id.in.(${userIds.join(",")}),user_id.in.(${userIds.join(",")})`);

    residents?.forEach((resident) => {
      const residentName = resident.full_name?.trim();
      if (!residentName) return;

      if (resident.user_id?.trim()) {
        residentNameByUserId.set(resident.user_id.trim(), residentName);
      }

      if (resident.id?.trim() && !residentNameByUserId.has(resident.id.trim())) {
        residentNameByUserId.set(resident.id.trim(), residentName);
      }
    });
  }

  return reportRows.map((report) => ({
    id: `report-${report.id}`,
    category: "report",
    href: "/admin/reports",
    title: report.description?.trim() || "Untitled report",
    subtitle:
      residentNameByUserId.get(report.user_id?.trim() ?? "") ||
      report.category?.trim() ||
      report.id,
    badge: normalizeReportStatus(report.status),
    badgeTone: normalizeReportStatusTone(report.status)
  }));
}

async function searchAnnouncements(likePattern: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, content, is_published")
    .or(`title.ilike.${likePattern},content.ilike.${likePattern},id.ilike.${likePattern}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  return (data ?? []).map((announcement) => ({
    id: `announcement-${announcement.id}`,
    category: "announcement",
    href: "/admin/announcements",
    title: announcement.title?.trim() || "Untitled announcement",
    subtitle: announcement.content?.trim() || announcement.id,
    badge: announcement.is_published ? "Published" : "Draft",
    badgeTone: announcement.is_published ? "approved" : "pending"
  }));
}

async function searchOfficeAccounts(likePattern: string): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .in("role", ["admin", "staff"])
    .or(`full_name.ilike.${likePattern},email.ilike.${likePattern},id.ilike.${likePattern}`)
    .order("full_name", { ascending: true })
    .limit(5);

  if (error) throw error;

  return (data ?? []).map((account) => ({
    id: `office-${account.id}`,
    category: "office",
    href: "/admin/staff",
    title: account.full_name?.trim() || "Unnamed office user",
    subtitle: account.email?.trim() || account.id,
    badge: normalizeOfficeBadge(account.role, account.status),
    badgeTone: normalizeOfficeBadgeTone(account.role, account.status)
  }));
}

function buildLikePattern(value: string) {
  const safeValue = value
    .replace(/[%_]/g, "")
    .replace(/,/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, "%")
    .trim();

  return `%${safeValue}%`;
}

function normalizeResidentStatus(status?: string | null) {
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === "approved") return "Approved";
  if (normalizedStatus === "rejected") return "Rejected";

  return "Pending";
}

function normalizeResidentStatusTone(status?: string | null): GlobalSearchResult["badgeTone"] {
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === "approved") return "approved";
  if (normalizedStatus === "rejected") return "flagged";

  return "pending";
}

function normalizeReportStatus(status?: string | null) {
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === "resolved") return "Resolved";
  if (normalizedStatus === "in progress") return "In Progress";

  return "Pending";
}

function normalizeReportStatusTone(status?: string | null): GlobalSearchResult["badgeTone"] {
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === "resolved") return "approved";
  if (normalizedStatus === "in progress") return "info";

  return "pending";
}

function normalizeOfficeBadge(role?: string | null, status?: string | null) {
  const normalizedRole = role?.trim().toLowerCase();
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === "pending") return "Pending";
  if (normalizedStatus === "rejected") return "Rejected";
  if (normalizedRole === "admin") return "Admin";

  return "Staff";
}

function normalizeOfficeBadgeTone(
  role?: string | null,
  status?: string | null
): GlobalSearchResult["badgeTone"] {
  const normalizedRole = role?.trim().toLowerCase();
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === "pending") return "pending";
  if (normalizedStatus === "rejected") return "flagged";
  if (normalizedRole === "admin") return "approved";

  return "info";
}
