"use client";

import {
  Bell,
  ClipboardCheck,
  FileWarning,
  MapPinned,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";
import { fetchAnnouncements, fetchAnnouncementSummary } from "@/lib/announcements";
import { fetchReports, fetchReportSummary } from "@/lib/reports";
import { fetchResidents, fetchResidentSummary } from "@/lib/residents";
import { normalizeReportStatus } from "@/lib/report-utils";
import { canViewAnalytics } from "@/lib/roles";
import type { Announcement, CommunityReport, Resident } from "@/lib/types";

type DashboardSummary = {
  announcements: {
    published: number;
    total: number;
  };
  reports: {
    mapped: number;
    pending: number;
    progress: number;
    resolved: number;
    total: number;
  };
  residents: {
    pending: number;
    total: number;
  };
};

const emptySummary: DashboardSummary = {
  announcements: { published: 0, total: 0 },
  reports: { mapped: 0, pending: 0, progress: 0, resolved: 0, total: 0 },
  residents: { pending: 0, total: 0 }
};

export default function AdminDashboardPage() {
  const { role } = useAdminRole();
  const allowAnalytics = canViewAnalytics(role);
  const [recentReports, setRecentReports] = useState<CommunityReport[]>([]);
  const [recentResidents, setRecentResidents] = useState<Resident[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboard() {
    setIsLoading(true);
    setMessage("");

    try {
      const [
        nextReports,
        nextResidents,
        nextAnnouncements,
        reportSummary,
        residentSummary,
        announcementSummary
      ] = await Promise.all([
        fetchReports({ limit: 4 }),
        fetchResidents({ limit: 4 }),
        fetchAnnouncements({ limit: 3 }),
        fetchReportSummary(),
        fetchResidentSummary(),
        fetchAnnouncementSummary()
      ]);

      setRecentReports(nextReports);
      setRecentResidents(nextResidents);
      setRecentAnnouncements(nextAnnouncements);
      setSummary({
        announcements: announcementSummary,
        reports: reportSummary,
        residents: residentSummary
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <span>Barangay admin command center</span>
          <h2>Dashboard Overview</h2>
          <p>
            Monitor resident verification, community reports, map activity, and
            public announcements from one workspace.
          </p>
        </div>
        <button onClick={loadDashboard} type="button">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message ? (
        <div className="admin-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="dashboard-loading">Loading dashboard data...</div>
      ) : (
        <>
          <div className="dashboard-stat-grid">
            <DashboardStat
              href="/admin/reports"
              icon={FileWarning}
              label="Pending Reports"
              tone="gold"
              value={summary.reports.pending}
              note={`${summary.reports.progress} in progress`}
            />
            <DashboardStat
              href="/admin/residents"
              icon={UsersRound}
              label="Pending Residents"
              tone="blue"
              value={summary.residents.pending}
              note={`${summary.residents.total} total residents`}
            />
            <DashboardStat
              href="/admin/map"
              icon={MapPinned}
              label="Mapped Reports"
              tone="teal"
              value={summary.reports.mapped}
              note="Reports with location pins"
            />
            <DashboardStat
              href="/admin/announcements"
              icon={Megaphone}
              label="Live Announcements"
              tone="green"
              value={summary.announcements.published}
              note={`${summary.announcements.total} total posts`}
            />
          </div>

          <div className="dashboard-grid">
            <DashboardPanel
              actionHref="/admin/reports"
              actionLabel="Open reports"
              icon={ClipboardCheck}
              title="Recent Community Reports"
            >
              <div className="dashboard-list">
                {recentReports.length === 0 ? (
                  <EmptyDashboardText text="No reports submitted yet." />
                ) : (
                  recentReports.map((report) => (
                    <ReportPreview key={report.id} report={report} />
                  ))
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel
              actionHref="/admin/residents"
              actionLabel="Review residents"
              icon={ShieldCheck}
              title="Resident Verification Queue"
            >
              <div className="dashboard-list">
                {recentResidents.length === 0 ? (
                  <EmptyDashboardText text="No resident registrations yet." />
                ) : (
                  recentResidents.map((resident) => (
                    <ResidentPreview key={resident.id} resident={resident} />
                  ))
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel
              actionHref="/admin/announcements"
              actionLabel="Manage posts"
              icon={Bell}
              title="Latest Announcements"
            >
              <div className="dashboard-list">
                {recentAnnouncements.length === 0 ? (
                  <EmptyDashboardText text="No announcements posted yet." />
                ) : (
                  recentAnnouncements.map((announcement) => (
                    <AnnouncementPreview key={announcement.id} announcement={announcement} />
                  ))
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel
              actionHref={allowAnalytics ? "/admin/analytics" : undefined}
              actionLabel={allowAnalytics ? "View analytics" : undefined}
              icon={RefreshCw}
              title={allowAnalytics ? "Workload Snapshot" : "Workload Summary"}
            >
              <div className="workload-snapshot">
                <SnapshotRow label="Pending" value={summary.reports.pending} tone="gold" />
                <SnapshotRow label="In Progress" value={summary.reports.progress} tone="blue" />
                <SnapshotRow label="Resolved" value={summary.reports.resolved} tone="green" />
              </div>
            </DashboardPanel>
          </div>
        </>
      )}
    </section>
  );
}

function DashboardStat({
  href,
  icon: Icon,
  label,
  note,
  tone,
  value
}: {
  href: string;
  icon: typeof FileWarning;
  label: string;
  note: string;
  tone: string;
  value: number;
}) {
  return (
    <Link className={`dashboard-stat ${tone}`} href={href}>
      <span><Icon size={22} /></span>
      <strong>{value}</strong>
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
  children: React.ReactNode;
  icon: typeof ClipboardCheck;
  title: string;
}) {
  return (
    <section className="dashboard-panel">
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

function ReportPreview({ report }: { report: CommunityReport }) {
  return (
    <Link className="dashboard-preview" href="/admin/reports">
      <div>
        <strong>{report.description?.trim() || "Untitled community report"}</strong>
        <span>{report.reporter_name ?? "Unknown resident"} • {shortDate(report.created_at)}</span>
      </div>
      <StatusPill status={normalizeReportStatus(report.status)} />
    </Link>
  );
}

function ResidentPreview({ resident }: { resident: Resident }) {
  return (
    <Link className="dashboard-preview" href="/admin/residents">
      <div>
        <strong>{resident.full_name || "Unnamed resident"}</strong>
        <span>{resident.address || "No address provided"} • {shortDate(resident.created_at)}</span>
      </div>
      <StatusPill status={resident.status === "rejected" ? "flagged" : resident.status} />
    </Link>
  );
}

function AnnouncementPreview({ announcement }: { announcement: Announcement }) {
  return (
    <Link className="dashboard-preview" href="/admin/announcements">
      <div>
        <strong>{announcement.title || "Untitled announcement"}</strong>
        <span>{shortDate(announcement.created_at)}</span>
      </div>
      <StatusPill status={announcement.is_published ? "published" : "draft"} />
    </Link>
  );
}

function SnapshotRow({
  label,
  tone,
  value
}: {
  label: string;
  tone: string;
  value: number;
}) {
  const max = Math.max(value, 1);

  return (
    <div className="snapshot-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <i><b className={tone} style={{ width: `${Math.max(8, (value / max) * 100)}%` }} /></i>
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
