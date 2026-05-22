"use client";

import {
  BellRing,
  ClipboardCheck,
  FileText,
  FileWarning,
  MapPinned,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { fetchAnnouncements } from "@/lib/announcements";
import { fetchReports } from "@/lib/reports";
import { normalizeReportStatus, shortReportCategory } from "@/lib/report-utils";
import { fetchResidents } from "@/lib/residents";
import { canViewAnalytics } from "@/lib/roles";
import type { Announcement, CommunityReport, Resident } from "@/lib/types";

export default function AdminDashboardPage() {
  const { role } = useAdminRole();
  const allowAnalytics = canViewAnalytics(role);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  async function loadDashboard() {
    setIsLoading(true);
    setMessage("");

    try {
      const [nextReports, nextResidents, nextAnnouncements] = await Promise.all([
        fetchReports(),
        fetchResidents(),
        fetchAnnouncements()
      ]);

      setReports(nextReports);
      setResidents(nextResidents);
      setAnnouncements(nextAnnouncements);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const dashboard = useMemo(() => buildDashboardData(reports, residents, announcements), [announcements, reports, residents]);

  return (
    <section className="dashboard-page dashboard-page-enhanced">
      <div className="dashboard-overview-hero">
        <div className="dashboard-overview-copy">
          <span>Barangay admin command center</span>
          <h2>Dashboard Overview</h2>
          <p>
            Monitor urgent cases, resident verification workload, communications readiness, and field visibility from one
            government-focused workspace.
          </p>
        </div>
        <div className="dashboard-overview-side">
          <div className="dashboard-overview-meta">
            <article>
              <strong>Open cases</strong>
              <p>{dashboard.activeReports} active service concerns</p>
            </article>
            <article>
              <strong>Last refreshed</strong>
              <p>{lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "Waiting for first sync"}</p>
            </article>
          </div>
          <button aria-label="Refresh dashboard" onClick={loadDashboard} title="Refresh dashboard" type="button">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {message ? (
        <div className="admin-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="dashboard-stat-grid dashboard-stat-grid-enhanced">
        <DashboardStat href="/admin/reports" icon={FileWarning} label="Pending Reports" tone="gold" value={dashboard.pendingReports} note={`${dashboard.progressReports} in progress`} />
        <DashboardStat href="/admin/residents" icon={UsersRound} label="Pending Residents" tone="blue" value={dashboard.pendingResidents} note={`${dashboard.approvedResidents} approved residents`} />
        <DashboardStat href="/admin/map" icon={MapPinned} label="Mapped Reports" tone="teal" value={dashboard.mappedReports} note={`${dashboard.mappedCoverage}% geotag coverage`} />
        <DashboardStat href="/admin/announcements" icon={Megaphone} label="Published Notices" tone="green" value={dashboard.publishedAnnouncements} note={`${dashboard.draftAnnouncements} drafts waiting`} />
        <DashboardStat href="/admin/reports" icon={ShieldAlert} label="Overdue Open Cases" tone="rose" value={dashboard.overdueOpenReports} note="Pending for 7+ days" />
        <DashboardStat href={allowAnalytics ? "/admin/analytics" : "/admin/reports"} icon={TrendingUp} label="Top Concern" tone="sky" valueLabel={shortReportCategory(dashboard.topCategory)} note={`${dashboard.reportsThisMonth} reports this month`} />
      </div>

      <div className="dashboard-priority-grid">
        <FeatureSummaryCard
          badge={`${dashboard.pendingReports} for review`}
          badgeTone="gold"
          icon={ClipboardCheck}
          title="Immediate Action Queue"
          subtitle="The most urgent workload that needs barangay action today."
          items={[
            { label: "Pending reports", value: dashboard.pendingReports, href: "/admin/reports" },
            { label: "Pending residents", value: dashboard.pendingResidents, href: "/admin/residents" },
            { label: "Overdue open cases", value: dashboard.overdueOpenReports, href: "/admin/reports" },
            { label: "Draft announcements", value: dashboard.draftAnnouncements, href: "/admin/announcements" }
          ]}
        />
        <FeatureSummaryCard
          badge={`${dashboard.resolutionRate}% closure rate`}
          badgeTone="blue"
          icon={FileText}
          title="Service Operations Snapshot"
          subtitle="At-a-glance operational view of report handling across the barangay."
          items={[
            { label: "Total reports", value: dashboard.totalReports, href: "/admin/reports" },
            { label: "In progress", value: dashboard.progressReports, href: "/admin/reports" },
            { label: "Resolved", value: dashboard.resolvedReports, href: "/admin/reports" },
            { label: "Unmapped open cases", value: dashboard.unmappedOpenReports, href: "/admin/map" }
          ]}
        />
      </div>

      <div className="dashboard-grid dashboard-grid-enhanced">
        <DashboardPanel actionHref="/admin/reports" actionLabel="Open reports" icon={ClipboardCheck} title="Recent Community Reports">
          <div className="dashboard-list dashboard-list-large">
            {dashboard.recentReports.length === 0 ? (
              <EmptyDashboardText text="No reports submitted yet." />
            ) : (
              dashboard.recentReports.map((report) => <ReportPreview key={report.id} report={report} />)
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel actionHref="/admin/residents" actionLabel="Review residents" icon={ShieldCheck} title="Resident Verification Queue">
          <div className="dashboard-list dashboard-list-large">
            {dashboard.recentResidents.length === 0 ? (
              <EmptyDashboardText text="No resident registrations yet." />
            ) : (
              dashboard.recentResidents.map((resident) => <ResidentPreview key={resident.id} resident={resident} />)
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel actionHref="/admin/announcements" actionLabel="Manage notices" icon={BellRing} title="Public Communications Board">
          <div className="dashboard-list dashboard-list-large">
            {dashboard.recentAnnouncements.length === 0 ? (
              <EmptyDashboardText text="No announcements posted yet." />
            ) : (
              dashboard.recentAnnouncements.map((announcement) => <AnnouncementPreview key={announcement.id} announcement={announcement} />)
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel actionHref={allowAnalytics ? "/admin/analytics" : undefined} actionLabel={allowAnalytics ? "View analytics" : undefined} icon={TrendingUp} title="Operational Indicators">
          <div className="workload-snapshot workload-snapshot-large">
            <SnapshotRow label="Pending reports" value={dashboard.pendingReports} max={dashboard.totalReports} tone="gold" />
            <SnapshotRow label="In progress" value={dashboard.progressReports} max={dashboard.totalReports} tone="blue" />
            <SnapshotRow label="Resolved" value={dashboard.resolvedReports} max={dashboard.totalReports} tone="green" />
            <SnapshotRow label="Pending residents" value={dashboard.pendingResidents} max={dashboard.totalResidents} tone="rose" />
          </div>
        </DashboardPanel>
      </div>

      <div className="dashboard-utility-grid">
        <UtilityPanel title="Quick Government Actions" subtitle="Go straight to the most common administrative tasks.">
          <QuickActionLink href="/admin/residents" label="Approve pending residents" note={`${dashboard.pendingResidents} waiting`} />
          <QuickActionLink href="/admin/reports" label="Review pending reports" note={`${dashboard.pendingReports} unresolved submissions`} />
          <QuickActionLink href="/admin/map" label="Inspect map-based cases" note={`${dashboard.mappedReports} with valid coordinates`} />
          <QuickActionLink href="/admin/announcements" label="Publish public updates" note={`${dashboard.draftAnnouncements} drafts available`} />
        </UtilityPanel>

        <UtilityPanel title="Registry and Communications" subtitle="Key registry and public information health indicators.">
          <MiniMetricRow label="Resident approval rate" value={`${dashboard.approvalRate}%`} tone="blue" />
          <MiniMetricRow label="Announcement publishing rate" value={`${dashboard.publishingRate}%`} tone="teal" />
          <MiniMetricRow label="Report-to-resident ratio" value={`${dashboard.reportToResidentRatio}%`} tone="gold" />
          <MiniMetricRow label="Reports this month" value={dashboard.reportsThisMonth.toString()} tone="rose" />
        </UtilityPanel>
      </div>

      {isLoading ? <AdminLoadingOverlay label="Loading dashboard data..." /> : null}
    </section>
  );
}

function DashboardStat({
  href,
  icon: Icon,
  label,
  note,
  tone,
  value,
  valueLabel
}: {
  href: string;
  icon: typeof FileWarning;
  label: string;
  note: string;
  tone: string;
  value?: number;
  valueLabel?: string;
}) {
  return (
    <Link className={`dashboard-stat ${tone}`} href={href}>
      <span><Icon size={24} /></span>
      <strong>{typeof value === "number" ? value : valueLabel}</strong>
      <h3>{label}</h3>
      <p>{note}</p>
    </Link>
  );
}

function DashboardPanel({
  actionHref,
  actionLabel,
  children,
  icon: Icon,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  icon: typeof ClipboardCheck;
  title: string;
}) {
  return (
    <section className="dashboard-panel dashboard-panel-enhanced">
      <div className="dashboard-panel-head">
        <div>
          <span><Icon size={18} /></span>
          <h3>{title}</h3>
        </div>
        {actionHref && actionLabel ? <Link href={actionHref}>{actionLabel}</Link> : null}
      </div>
      {children}
    </section>
  );
}

function FeatureSummaryCard({
  badge,
  badgeTone,
  icon: Icon,
  items,
  subtitle,
  title
}: {
  badge: string;
  badgeTone: string;
  icon: typeof ClipboardCheck;
  items: Array<{ href: string; label: string; value: number }>;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="feature-summary-card">
      <div className="feature-summary-head">
        <div>
          <span><Icon size={19} /></span>
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </div>
        <em className={badgeTone}>{badge}</em>
      </div>
      <div className="feature-summary-list">
        {items.map((item) => (
          <Link className="feature-summary-item" href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

function UtilityPanel({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className="utility-panel">
      <div className="utility-panel-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="utility-panel-body">{children}</div>
    </section>
  );
}

function QuickActionLink({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <Link className="quick-action-link" href={href}>
      <div>
        <strong>{label}</strong>
        <span>{note}</span>
      </div>
      <em>Open</em>
    </Link>
  );
}

function MiniMetricRow({ label, tone, value }: { label: string; tone: string; value: string }) {
  return (
    <article className="mini-metric-row">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <i className={tone} />
    </article>
  );
}

function ReportPreview({ report }: { report: CommunityReport }) {
  const category = shortReportCategory(report.category);
  return (
    <Link className="dashboard-preview dashboard-preview-enhanced" href="/admin/reports">
      <div>
        <strong>{report.description?.trim() || "Untitled community report"}</strong>
        <span>{report.reporter_name ?? "Unknown resident"} | {category} | {shortDate(report.created_at)}</span>
      </div>
      <StatusPill status={normalizeReportStatus(report.status)} />
    </Link>
  );
}

function ResidentPreview({ resident }: { resident: Resident }) {
  return (
    <Link className="dashboard-preview dashboard-preview-enhanced" href="/admin/residents">
      <div>
        <strong>{resident.full_name || "Unnamed resident"}</strong>
        <span>{resident.address || "No address provided"} | {shortDate(resident.created_at)}</span>
      </div>
      <StatusPill status={resident.status === "rejected" ? "flagged" : resident.status} />
    </Link>
  );
}

function AnnouncementPreview({ announcement }: { announcement: Announcement }) {
  return (
    <Link className="dashboard-preview dashboard-preview-enhanced" href="/admin/announcements">
      <div>
        <strong>{announcement.title || "Untitled announcement"}</strong>
        <span>{shortDate(announcement.created_at)} | {announcement.is_published ? "Published" : "Draft"}</span>
      </div>
      <StatusPill status={announcement.is_published ? "published" : "draft"} />
    </Link>
  );
}

function SnapshotRow({
  label,
  max,
  tone,
  value
}: {
  label: string;
  max: number;
  tone: string;
  value: number;
}) {
  const denominator = Math.max(max, 1);

  return (
    <div className="snapshot-row snapshot-row-enhanced">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <i><b className={tone} style={{ width: `${Math.max(10, (value / denominator) * 100)}%` }} /></i>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "in progress"
      ? "In Progress"
      : status.charAt(0).toUpperCase() + status.slice(1);

  return <em className={`dashboard-pill ${status.replace(" ", "-")}`}>{label}</em>;
}

function EmptyDashboardText({ text }: { text: string }) {
  return <div className="dashboard-empty">{text}</div>;
}

function buildDashboardData(reports: CommunityReport[], residents: Resident[], announcements: Announcement[]) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let pendingReports = 0;
  let progressReports = 0;
  let resolvedReports = 0;
  let mappedReports = 0;
  let overdueOpenReports = 0;
  let unmappedOpenReports = 0;
  let reportsThisMonth = 0;
  const categoryCounts = new Map<string, number>();

  reports.forEach((report) => {
    const status = normalizeReportStatus(report.status);
    if (status === "pending") pendingReports += 1;
    if (status === "in progress") progressReports += 1;
    if (status === "resolved") resolvedReports += 1;

    const category = shortReportCategory(report.category);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

    const createdAt = new Date(report.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      if (createdAt <= sevenDaysAgo && status !== "resolved") overdueOpenReports += 1;
      if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) reportsThisMonth += 1;
    }

    const hasCoordinates =
      typeof report.latitude === "number" &&
      typeof report.longitude === "number" &&
      Number.isFinite(report.latitude) &&
      Number.isFinite(report.longitude) &&
      !(report.latitude === 0 && report.longitude === 0);

    if (hasCoordinates) {
      mappedReports += 1;
    } else if (status !== "resolved") {
      unmappedOpenReports += 1;
    }
  });

  let pendingResidents = 0;
  let approvedResidents = 0;
  residents.forEach((resident) => {
    if (resident.status === "pending") pendingResidents += 1;
    if (resident.status === "approved") approvedResidents += 1;
  });

  const publishedAnnouncements = announcements.filter((item) => item.is_published).length;
  const draftAnnouncements = announcements.filter((item) => !item.is_published).length;

  const topCategory =
    categoryCounts.size === 0
      ? "No reports"
      : Array.from(categoryCounts.entries()).reduce((best, current) => {
          if (best[1] === current[1]) return best[0].localeCompare(current[0]) <= 0 ? best : current;
          return best[1] > current[1] ? best : current;
        })[0];

  const totalReports = reports.length;
  const totalResidents = residents.length;
  const activeReports = pendingReports + progressReports;
  const mappedCoverage = totalReports === 0 ? 0 : Math.round((mappedReports / totalReports) * 100);
  const resolutionRate = totalReports === 0 ? 0 : Math.round((resolvedReports / totalReports) * 100);
  const approvalRate = totalResidents === 0 ? 0 : Math.round((approvedResidents / totalResidents) * 100);
  const publishingRate = announcements.length === 0 ? 0 : Math.round((publishedAnnouncements / announcements.length) * 100);
  const reportToResidentRatio = totalResidents === 0 ? 0 : Math.round((totalReports / totalResidents) * 100);

  return {
    activeReports,
    approvalRate,
    approvedResidents,
    draftAnnouncements,
    mappedCoverage,
    mappedReports,
    overdueOpenReports,
    pendingResidents,
    pendingReports,
    progressReports,
    publishedAnnouncements,
    publishingRate,
    recentAnnouncements: announcements.slice(0, 4),
    recentReports: reports.slice(0, 5),
    recentResidents: residents.slice(0, 5),
    reportToResidentRatio,
    reportsThisMonth,
    resolvedReports,
    resolutionRate,
    topCategory,
    totalReports,
    totalResidents,
    unmappedOpenReports
  };
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shortDate(value?: string) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
