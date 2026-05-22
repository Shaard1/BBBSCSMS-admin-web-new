"use client";

import {
  BellRing,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { fetchAnnouncements } from "@/lib/announcements";
import { fetchReports } from "@/lib/reports";
import { normalizeReportCategory, normalizeReportStatus, reportCategoryOptions, shortReportCategory } from "@/lib/report-utils";
import { fetchResidents } from "@/lib/residents";
import type { Announcement, CommunityReport, Resident } from "@/lib/types";

const categoryOrder = [...reportCategoryOptions];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnalyticsPage() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  async function loadAnalytics() {
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
      setMessage(error instanceof Error ? error.message : "Failed to load analytics.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const analytics = useMemo(() => buildAnalytics(reports, residents, announcements), [announcements, reports, residents]);

  return (
    <section className="admin-page analytics-page">
      <div className="analytics-overview-hero">
        <div className="analytics-overview-copy">
          <span>Barangay operations intelligence</span>
          <h2>Barangay Analytics Center</h2>
          <p>
            Review service demand, verification workload, communication readiness, and operational pressure from one
            government-focused monitoring screen.
          </p>
        </div>
        <div className="analytics-overview-side">
          <div className="analytics-overview-meta">
            <article>
              <strong>Monitoring period</strong>
              <p>{analytics.reportingPeriod}</p>
            </article>
            <article>
              <strong>Last refreshed</strong>
              <p>{lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "Waiting for first sync"}</p>
            </article>
          </div>
          <button aria-label="Refresh analytics" onClick={loadAnalytics} title="Refresh analytics" type="button">
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

      <div className="analytics-hero-grid">
        <HeroInsightCard
          label="Open case backlog"
          value={analytics.activeReports.toString()}
          note={`${analytics.overdueOpenReports} cases pending for 7+ days`}
          tone="blue"
        />
        <HeroInsightCard
          label="Verification queue"
          value={analytics.pendingResidents.toString()}
          note={`${analytics.approvedResidents} approved residents on record`}
          tone="gold"
        />
        <HeroInsightCard
          label="Public notices live"
          value={analytics.publishedAnnouncements.toString()}
          note={`${analytics.draftAnnouncements} drafts awaiting publication review`}
          tone="teal"
        />
      </div>

      <div className="analytics-metric-grid analytics-metric-grid-expanded">
        <MetricCard icon={ClipboardList} label="Total Cases" note="All submitted community reports" value={analytics.totalReports.toString()} tone="blue" />
        <MetricCard icon={FileWarning} label="Pending Review" note="Awaiting triage or assignment" value={analytics.pendingReports.toString()} tone="gold" />
        <MetricCard icon={RefreshCw} label="In Progress" note="Cases currently under action" value={analytics.progressReports.toString()} tone="sky" />
        <MetricCard icon={ClipboardCheck} label="Resolved Cases" note={`${analytics.resolutionRate}% closure rate`} value={analytics.resolvedReports.toString()} tone="green" />
        <MetricCard icon={UsersRound} label="Resident Registry" note={`${analytics.approvalRate}% approval rate`} value={analytics.totalResidents.toString()} tone="teal" />
        <MetricCard icon={ShieldAlert} label="Overdue Open Cases" note="Open for 7 days or longer" value={analytics.overdueOpenReports.toString()} tone="rose" />
      </div>

      <div className="analytics-main-grid analytics-main-grid-large">
        <AnalyticsPanel
          title="Case Handling Status"
          subtitle="Current distribution of complaint processing stages for barangay response management."
          badge={`${analytics.activeReports} open cases`}
          badgeTone="rose"
        >
          <StatusDistribution analytics={analytics} />
        </AnalyticsPanel>
        <AnalyticsPanel
          title="Monthly Service Activity"
          subtitle="Compare report submissions and resident registrations across the current dataset."
          badge={`Peak ${analytics.peakMonth}`}
          badgeTone="blue"
        >
          <GroupedMonthlyBars reportValues={analytics.monthlyReports} residentValues={analytics.monthlyResidents} />
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Service Demand by Category"
        subtitle="Highlights which public concerns require the strongest operational attention and field response."
        badge={`Top concern: ${shortReportCategory(analytics.topCategory)}`}
        badgeTone="teal"
      >
        <CategoryBreakdown counts={analytics.categoryCounts} />
      </AnalyticsPanel>

      <div className="analytics-support-grid">
        <AnalyticsPanel
          title="Resident Registry Status"
          subtitle="Track verification workload and approval movement for the barangay resident database."
          badge={`${analytics.pendingResidents} awaiting review`}
          badgeTone="gold"
        >
          <DetailStatsList
            items={[
              { label: "Approved residents", value: analytics.approvedResidents, tone: "green" },
              { label: "Pending verification", value: analytics.pendingResidents, tone: "gold" },
              { label: "Rejected applications", value: analytics.rejectedResidents, tone: "rose" },
              { label: "New registrations this month", value: analytics.newResidentsThisMonth, tone: "blue" }
            ]}
          />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Public Communication Readiness"
          subtitle="Monitor whether information materials are ready for public release and resident awareness."
          badge={`${analytics.publishedAnnouncements} published`}
          badgeTone="blue"
        >
          <DetailStatsList
            items={[
              { label: "Published announcements", value: analytics.publishedAnnouncements, tone: "green" },
              { label: "Draft announcements", value: analytics.draftAnnouncements, tone: "gold" },
              { label: "Posts created this month", value: analytics.announcementsThisMonth, tone: "blue" },
              { label: "Publishing rate", value: `${analytics.announcementPublishingRate}%`, tone: "teal" }
            ]}
          />
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Operational Watchlist"
          subtitle="Focus on items that can affect field validation, response speed, and service quality."
          badge="Action required"
          badgeTone="rose"
        >
          <DetailStatsList
            items={[
              { label: "Open cases without map location", value: analytics.unmappedReports, tone: "rose" },
              { label: "Geo-tagged report coverage", value: `${analytics.mappedCoverage}%`, tone: "teal" },
              { label: "Reports submitted this month", value: analytics.reportsThisMonth, tone: "blue" },
              { label: "Report-to-resident ratio", value: `${analytics.residentReportCoverage}%`, tone: "gold" }
            ]}
          />
        </AnalyticsPanel>
      </div>

      <div className="decision-grid analytics-signal-grid">
        <SignalCard
          icon={TrendingUp}
          title="Highest monthly case intake"
          value={analytics.peakMonth}
          tone="blue"
        />
        <SignalCard
          icon={MapPinned}
          title="Mapped service visibility"
          value={`${analytics.mappedReports} reports with valid coordinates`}
          tone="teal"
        />
        <SignalCard
          icon={ShieldCheck}
          title="Registry approval posture"
          value={`${analytics.approvalRate}% of residents approved`}
          tone="green"
        />
        <SignalCard
          icon={BellRing}
          title="Communications readiness"
          value={analytics.draftAnnouncements === 0 ? "All notices published" : `${analytics.draftAnnouncements} draft notices pending`}
          tone={analytics.draftAnnouncements === 0 ? "green" : "rose"}
        />
      </div>
      {isLoading ? <AdminLoadingOverlay label="Loading analytics..." /> : null}
    </section>
  );
}

function HeroInsightCard({ label, note, tone, value }: { label: string; note: string; tone: string; value: string }) {
  return (
    <article className={`analytics-hero-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function MetricCard({
  icon: Icon,
  label,
  note,
  value,
  tone
}: {
  icon: typeof ClipboardList;
  label: string;
  note: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={`analytics-metric ${tone}`}>
      <div>
        <span><Icon size={22} /></span>
        <strong>{value}</strong>
      </div>
      <h3>{label}</h3>
      <p>{note}</p>
    </article>
  );
}

function AnalyticsPanel({
  badge,
  badgeTone,
  children,
  subtitle,
  title
}: {
  badge: string;
  badgeTone: string;
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className={`analytics-badge ${badgeTone}`}>{badge}</span>
      </div>
      {children}
    </section>
  );
}

function StatusDistribution({ analytics }: { analytics: AnalyticsData }) {
  const total = analytics.totalReports;
  const items = [
    { label: "Pending review", value: analytics.pendingReports, tone: "gold" },
    { label: "In progress", value: analytics.progressReports, tone: "blue" },
    { label: "Resolved", value: analytics.resolvedReports, tone: "green" }
  ];

  if (total === 0) return <div className="analytics-empty">No report data yet.</div>;

  const segments = items.map((item) => ({
    ...item,
    percent: total === 0 ? 0 : Math.round((item.value / total) * 100)
  }));

  return (
    <div className="status-distribution">
      <div className="donut" style={{ background: donutGradient(segments) }}>
        <strong>{analytics.resolutionRate}%</strong>
        <span>resolved</span>
      </div>
      <div className="status-list">
        {segments.map((item) => (
          <div className="status-row" key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <i>
              <b className={item.tone} style={{ width: `${item.percent}%` }} />
            </i>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupedMonthlyBars({ reportValues, residentValues }: { reportValues: number[]; residentValues: number[] }) {
  const maxValue = Math.max(...reportValues, ...residentValues, 1);

  return (
    <div className="monthly-bars grouped-monthly-bars">
      {monthLabels.map((label, index) => (
        <div className="monthly-bar grouped" key={label}>
          <span>{reportValues[index] + residentValues[index]}</span>
          <div className="grouped-monthly-columns">
            <i className="reports" style={{ height: `${Math.max(reportValues[index] === 0 ? 8 : 14, (reportValues[index] / maxValue) * 100)}%` }} />
            <i className="residents" style={{ height: `${Math.max(residentValues[index] === 0 ? 8 : 14, (residentValues[index] / maxValue) * 100)}%` }} />
          </div>
          <small>{label}</small>
        </div>
      ))}
      <div className="grouped-monthly-legend">
        <span><b className="reports" /> Report intake</span>
        <span><b className="residents" /> Resident registrations</span>
      </div>
    </div>
  );
}

function CategoryBreakdown({ counts }: { counts: Record<string, number> }) {
  const maxValue = Math.max(...Object.values(counts), 1);

  return (
    <div className="category-breakdown">
      <div className="category-bars">
        {categoryOrder.map((category) => (
          <div className="category-bar" key={category}>
            <span>{shortReportCategory(category)}</span>
            <i>
              <b style={{ width: `${((counts[category] ?? 0) / maxValue) * 100}%` }} />
            </i>
            <strong>{counts[category] ?? 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailStatsList({ items }: { items: Array<{ label: string; tone: string; value: number | string }> }) {
  return (
    <div className="detail-stats-list">
      {items.map((item) => (
        <article className="detail-stat-row" key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <i className={item.tone} />
        </article>
      ))}
    </div>
  );
}

function SignalCard({
  icon: Icon,
  title,
  value,
  tone
}: {
  icon: typeof ClipboardList;
  title: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={`signal-card ${tone}`}>
      <span><Icon size={22} /></span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

type AnalyticsData = ReturnType<typeof buildAnalytics>;

function buildAnalytics(reports: CommunityReport[], residents: Resident[], announcements: Announcement[]) {
  const monthlyReports = Array.from({ length: 12 }, () => 0);
  const monthlyResidents = Array.from({ length: 12 }, () => 0);
  const categoryCounts = Object.fromEntries(categoryOrder.map((category) => [category, 0]));

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  let pendingReports = 0;
  let progressReports = 0;
  let resolvedReports = 0;
  let mappedReports = 0;
  let overdueOpenReports = 0;
  let reportsThisMonth = 0;

  reports.forEach((report) => {
    const status = normalizeReportStatus(report.status);
    if (status === "pending") pendingReports += 1;
    if (status === "in progress") progressReports += 1;
    if (status === "resolved") resolvedReports += 1;

    const createdAt = new Date(report.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      monthlyReports[createdAt.getMonth()] += 1;

      if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) {
        reportsThisMonth += 1;
      }

      if (createdAt <= sevenDaysAgo && status !== "resolved") {
        overdueOpenReports += 1;
      }
    }

    if (typeof report.latitude === "number" && typeof report.longitude === "number") {
      const hasCoordinates = Number.isFinite(report.latitude) && Number.isFinite(report.longitude) && !(report.latitude === 0 && report.longitude === 0);
      if (hasCoordinates) mappedReports += 1;
    }

    const category = normalizeReportCategory(report.category);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  });

  let approvedResidents = 0;
  let pendingResidents = 0;
  let rejectedResidents = 0;
  let newResidentsThisMonth = 0;

  residents.forEach((resident) => {
    if (resident.status === "approved") approvedResidents += 1;
    if (resident.status === "pending") pendingResidents += 1;
    if (resident.status === "rejected") rejectedResidents += 1;

    const createdAt = new Date(resident.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      monthlyResidents[createdAt.getMonth()] += 1;

      if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) {
        newResidentsThisMonth += 1;
      }
    }
  });

  const publishedAnnouncements = announcements.filter((item) => item.is_published).length;
  const draftAnnouncements = announcements.filter((item) => !item.is_published).length;
  const announcementsThisMonth = announcements.filter((item) => {
    const createdAt = new Date(item.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
  }).length;

  const totalReports = reports.length;
  const totalResidents = residents.length;
  const totalAnnouncements = announcements.length;
  const activeReports = pendingReports + progressReports;
  const unmappedReports = Math.max(0, totalReports - mappedReports);
  const resolutionRate = totalReports === 0 ? 0 : Math.round((resolvedReports / totalReports) * 100);
  const residentReportCoverage = totalResidents === 0 ? 0 : Math.round((totalReports / totalResidents) * 100);
  const approvalRate = totalResidents === 0 ? 0 : Math.round((approvedResidents / totalResidents) * 100);
  const announcementPublishingRate = totalAnnouncements === 0 ? 0 : Math.round((publishedAnnouncements / totalAnnouncements) * 100);
  const mappedCoverage = totalReports === 0 ? 0 : Math.round((mappedReports / totalReports) * 100);

  const topCategory =
    Object.values(categoryCounts).every((value) => value === 0)
      ? "No reports"
      : Object.entries(categoryCounts).reduce((best, current) => {
          if (best[1] === current[1]) return best[0].localeCompare(current[0]) <= 0 ? best : current;
          return best[1] > current[1] ? best : current;
        })[0];

  const peakMonthEntry = monthlyReports.reduce(
    (best, value, index) => {
      if (best.value === value) return best.index < index ? best : { index, value };
      return best.value > value ? best : { index, value };
    },
    { index: 0, value: 0 }
  );

  const peakMonth = peakMonthEntry.value === 0 ? "No activity" : `${monthLabels[peakMonthEntry.index]} (${peakMonthEntry.value})`;

  const validDates = [
    ...reports.map((item) => item.created_at),
    ...residents.map((item) => item.created_at),
    ...announcements.map((item) => item.created_at)
  ]
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  const reportingPeriod =
    validDates.length === 0
      ? "No activity recorded yet"
      : `${monthLabels[validDates[0].getMonth()]} ${validDates[0].getFullYear()} to ${monthLabels[validDates[validDates.length - 1].getMonth()]} ${validDates[validDates.length - 1].getFullYear()}`;

  return {
    activeReports,
    announcementPublishingRate,
    announcementsThisMonth,
    approvalRate,
    approvedResidents,
    categoryCounts,
    draftAnnouncements,
    mappedCoverage,
    mappedReports,
    monthlyReports,
    monthlyResidents,
    newResidentsThisMonth,
    overdueOpenReports,
    peakMonth,
    pendingReports,
    pendingResidents,
    progressReports,
    publishedAnnouncements,
    rejectedResidents,
    reportingPeriod,
    residentReportCoverage,
    resolutionRate,
    reportsThisMonth,
    resolvedReports,
    topCategory,
    totalAnnouncements,
    totalReports,
    totalResidents,
    unmappedReports
  };
}

function donutGradient(segments: Array<{ percent: number; tone: string }>) {
  const colors: Record<string, string> = {
    blue: "#0087EF",
    gold: "#E4A000",
    green: "#2FB887"
  };
  let start = 0;
  const stops = segments
    .filter((segment) => segment.percent > 0)
    .map((segment) => {
      const end = start + segment.percent;
      const stop = `${colors[segment.tone]} ${start}% ${end}%`;
      start = end;
      return stop;
    });

  return `conic-gradient(${stops.join(", ")})`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  });
}
