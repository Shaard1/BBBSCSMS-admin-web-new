import { residentAccess, accessLabels } from "./resident-state";
import type { Resident } from "./types";
import { supabase } from "@/lib/supabase";
import { canManageOfficeAccounts, type OfficeRole } from "@/lib/roles";
export type GlobalSearchResult = {
    id: string;
    category: "resident" | "report" | "document" | "announcement" | "office" | "page";
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
        id: "page-documents",
        category: "page",
        href: "/admin/documents",
        title: "Document Requests",
        subtitle: "Review certificate and permit requests from residents",
        badge: "Page",
        badgeTone: "info" as const,
        keywords: ["documents", "certificates", "requests", "permits", "clearance"]
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
        title: "Resident Accounts",
        subtitle: "Manage access and view service-specific verification",
        badge: "Page",
        badgeTone: "info" as const,
        keywords: ["resident", "accounts", "access", "verification", "applications"]
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
] satisfies Array<GlobalSearchResult & {
    keywords: string[];
}>;
export async function fetchGlobalSearchResults(query: string, role: OfficeRole) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
        return [];
    }
    const likePattern = buildLikePattern(normalizedQuery);
    const pageResults = searchAdminPages(normalizedQuery, role);
    const settledResults = await Promise.all([
        searchResidents(likePattern, normalizedQuery),
        searchReports(likePattern),
        searchDocumentRequests(likePattern),
        searchAnnouncements(likePattern),
        canManageOfficeAccounts(role) ? searchOfficeAccounts(likePattern) : Promise.resolve([])
    ]);
    const [residentResults, reportResults, documentResults, announcementResults, officeResults] = settledResults;
    return [
        ...pageResults,
        ...residentResults,
        ...reportResults,
        ...documentResults,
        ...announcementResults,
        ...officeResults
    ];
}
function searchAdminPages(query: string, role: OfficeRole): GlobalSearchResult[] {
    const normalizedQuery = query.trim().toLowerCase();
    return adminPageResults
        .filter((result) => {
        if (result.href === "/admin/analytics" && role !== "admin")
            return false;
        if (result.href === "/admin/staff" && !canManageOfficeAccounts(role))
            return false;
        return `${result.title} ${result.subtitle} ${result.keywords.join(" ")}`
            .toLowerCase()
            .includes(normalizedQuery);
    })
        .slice(0, 5);
}
async function searchResidents(likePattern: string, query: string): Promise<GlobalSearchResult[]> {
    const { data: directory, error: directoryError } = await supabase.rpc("get_resident_directory", { p_search: query, p_page_size: 5 });
    if (directoryError && directoryError.code !== "PGRST202")
        throw directoryError;
    if (!directoryError)
        return directory.items.map((resident: Resident) => ({ id: `resident-${resident.id}`, category: "resident", href: `/admin/residents?resident=${resident.id}`, title: resident.full_name, subtitle: resident.basic_account?.declared_phone || resident.contact_number || resident.id, badge: accessLabels[residentAccess(resident)], badgeTone: residentAccess(resident) === "active" ? "approved" : "pending" }));
    const { data, error } = await supabase
        .from("residents")
        .select("id, user_id, full_name, address, contact_number, status")
        .or(`full_name.ilike.${likePattern},address.ilike.${likePattern},contact_number.ilike.${likePattern}${uuidSearchClause(likePattern)}`)
        .order("created_at", { ascending: false })
        .limit(5);
    if (error)
        throw error;
    const {data:accounts,error:accountError}=await supabase.rpc('get_office_resident_accounts');
    if(accountError&&accountError.code!=='PGRST202')throw accountError;
    const byUser=new Map<string,NonNullable<Resident['basic_account']>>(((accounts??[]) as Array<NonNullable<Resident['basic_account']>&{user_id:string}>).map(a=>[a.user_id,a]));
    return (data??[]).map(record=>{
      const resident={...record,created_at:'',basic_account:byUser.get(record.user_id||record.id)} as Resident;
      const access=residentAccess(resident);
      return {id: 'resident-'+resident.id,category:'resident',href:'/admin/residents?resident='+resident.id,title:resident.full_name||'Unnamed resident',subtitle:resident.contact_number||resident.id,badge:accessLabels[access],badgeTone:access==='active'?'approved':access==='suspended'?'flagged':'pending'};
    });
}
async function searchReports(likePattern: string): Promise<GlobalSearchResult[]> {
    const { data, error } = await supabase
        .from("reports")
        .select("id, description, category, status, user_id")
        .or(`description.ilike.${likePattern},category.ilike.${likePattern},status.ilike.${likePattern}${uuidSearchClause(likePattern)}`)
        .order("created_at", { ascending: false })
        .limit(5);
    if (error)
        throw error;
    const reportRows = data ?? [];
    const userIds = Array.from(new Set(reportRows
        .map((report) => report.user_id?.trim())
        .filter((userId): userId is string => Boolean(userId) && isUuid(userId))));
    const residentNameByUserId = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: residents } = await supabase
            .from("residents")
            .select("id, user_id, full_name")
            .or(`id.in.(${userIds.join(",")}),user_id.in.(${userIds.join(",")})`);
        residents?.forEach((resident) => {
            const residentName = resident.full_name?.trim();
            if (!residentName)
                return;
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
        subtitle: residentNameByUserId.get(report.user_id?.trim() ?? "") ||
            report.category?.trim() ||
            report.id,
        badge: normalizeReportStatus(report.status),
        badgeTone: normalizeReportStatusTone(report.status)
    }));
}
async function searchDocumentRequests(likePattern: string): Promise<GlobalSearchResult[]> {
    const { data, error } = await supabase
        .from("document_requests")
        .select("id, resident_name, certificate_title, status, purpose")
        .or(`resident_name.ilike.${likePattern},certificate_title.ilike.${likePattern},purpose.ilike.${likePattern},status.ilike.${likePattern}${uuidSearchClause(likePattern)}`)
        .order("created_at", { ascending: false })
        .limit(5);
    if (error)
        throw error;
    return (data ?? []).map((request) => ({
        id: `document-${request.id}`,
        category: "document",
        href: `/admin/documents?request=${request.id}`,
        title: request.certificate_title?.trim() || "Document Request",
        subtitle: request.resident_name?.trim() || request.purpose?.trim() || request.id,
        badge: normalizeDocumentStatus(request.status),
        badgeTone: normalizeDocumentStatusTone(request.status)
    }));
}
async function searchAnnouncements(likePattern: string): Promise<GlobalSearchResult[]> {
    const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, is_published")
        .or(`title.ilike.${likePattern},content.ilike.${likePattern}${uuidSearchClause(likePattern)}`)
        .order("created_at", { ascending: false })
        .limit(5);
    if (error)
        throw error;
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
        .or(`full_name.ilike.${likePattern},email.ilike.${likePattern}${uuidSearchClause(likePattern)}`)
        .order("full_name", { ascending: true })
        .limit(5);
    if (error)
        throw error;
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
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\s+/g, "%")
        .trim();
    return safeValue ? `%${safeValue}%` : "__no_search_match__";
}
function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function normalizeReportStatus(status?: string | null) {
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === "resolved")
        return "Resolved";
    if (normalizedStatus === "in progress")
        return "In Progress";
    return "Pending";
}
function normalizeReportStatusTone(status?: string | null): GlobalSearchResult["badgeTone"] {
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === "resolved")
        return "approved";
    if (normalizedStatus === "in progress")
        return "info";
    return "pending";
}
function normalizeDocumentStatus(status?: string | null) {
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === "awaiting_payment")
        return "Awaiting Payment";
    if (normalizedStatus === "processing")
        return "Processing";
    if (normalizedStatus === "ready_for_release")
        return "Ready for Release";
    if (normalizedStatus === "completed")
        return "Completed";
    if (normalizedStatus === "rejected")
        return "Rejected";
    return "Pending";
}
function normalizeDocumentStatusTone(status?: string | null): GlobalSearchResult["badgeTone"] {
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === "completed")
        return "approved";
    if (normalizedStatus === "rejected")
        return "flagged";
    if (normalizedStatus === "processing" || normalizedStatus === "ready_for_release")
        return "info";
    return "pending";
}
function normalizeOfficeBadge(role?: string | null, status?: string | null) {
    const normalizedRole = role?.trim().toLowerCase();
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === "pending")
        return "Pending";
    if (normalizedStatus === "rejected")
        return "Rejected";
    if (normalizedRole === "admin")
        return "Admin";
    return "Staff";
}
function normalizeOfficeBadgeTone(role?: string | null, status?: string | null): GlobalSearchResult["badgeTone"] {
    const normalizedRole = role?.trim().toLowerCase();
    const normalizedStatus = status?.trim().toLowerCase();
    if (normalizedStatus === "pending")
        return "pending";
    if (normalizedStatus === "rejected")
        return "flagged";
    if (normalizedRole === "admin")
        return "approved";
    return "info";
}
export function uuidSearchClause(pattern: string) {
    const candidate = pattern.replace(/^%|%$/g, '');
    return isUuid(candidate) ? ',id.eq.' + candidate : '';
}
