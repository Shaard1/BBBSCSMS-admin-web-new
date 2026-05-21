"use client";

import {
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { fetchAnnouncements } from "@/lib/announcements";
import { fetchReports } from "@/lib/reports";
import { fetchResidents } from "@/lib/residents";
import {
  normalizeReportCategory,
  normalizeReportStatus,
  reportCategoryOptions,
  shortReportCategory
} from "@/lib/report-utils";
import type { Announcement, CommunityReport, Resident } from "@/lib/types";

const categoryOrder = [...reportCategoryOptions];

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

export default function AnalyticsPage() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load analytics.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const analytics = useMemo(() => buildAnalytics(reports, residents, announcements), [
    announcements,
    reports,
    residents
  ]);

  return (
    <section className="analytics-page">
      <div className="analytics-header">
        <div>
          <span>Barangay operations command view</span>
          <h2>Community Analytics</h2>
          <p>
            Monitor complaint workload, resident reach, and service pressure
            across the barangay.
          </p>
        </div>
        <div className="analytics-header-summary">
          <SummaryItem label="Active" value={analytics.activeReports.toString()} />
          <SummaryItem label="Closed" value={`${analytics.resolutionRate}%`} />
          <SummaryItem label="Focus" value={shortReportCategory(analytics.topCategory)} />
        </div>
      </div>

      {message ? (
        <div className="admin-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="analytics-actions">
        <button onClick={loadAnalytics} type="button">
          <RefreshCw size={16} /> Refresh analytics
        </button>
      </div>

      <div className="analytics-metric-grid">
        <MetricCard
          icon={ClipboardList}
          label="Total Cases"
          value={analytics.totalReports.toString()}
          note="Resident-submitted reports"
          tone="blue"
        />
        <MetricCard
          icon={FileWarning}
          label="Pending Review"
          value={analytics.pendingReports.toString()}
          note="Awaiting admin triage"
          tone="gold"
        />
        <MetricCard
          icon={RefreshCw}
          label="In Progress"
          value={analytics.progressReports.toString()}
          note="Currently being addressed"
          tone="sky"
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Resolved"
          value={analytics.resolvedReports.toString()}
          note={`${analytics.resolutionRate}% closure rate`}
          tone="green"
        />
        <MetricCard
          icon={UsersRound}
          label="Residents"
          value={analytics.totalResidents.toString()}
          note={`${analytics.residentReportCoverage}% report-to-resident ratio`}
          tone="teal"
        />
      </div>

      <div className="analytics-main-grid">
        <AnalyticsPanel
          title="Workload Status"
          subtitle="Live distribution of complaint handling stages."
          badge={`${analytics.activeReports} active`}
          badgeTone="rose"
        >
          <StatusDistribution analytics={analytics} />
        </AnalyticsPanel>
        <AnalyticsPanel
          title="Monthly Intake"
          subtitle="Report volume by month for the current dataset."
          badge={`Peak ${analytics.peakMonth}`}
          badgeTone="blue"
        >
          <MonthlyBars values={analytics.monthlyReports} />
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Service Pressure by Category"
        subtitle="Most common resident concerns requiring barangay attention."
        badge={`Top: ${shortReportCategory(analytics.topCategory)}`}
        badgeTone="teal"
      >
        <CategoryBreakdown counts={analytics.categoryCounts} />
      </AnalyticsPanel>

      <div className="decision-grid">
        <SignalCard
          icon={ShieldCheck}
          title="Backlog posture"
          value={analytics.activeReports === 0 ? "Clear" : `${analytics.activeReports} open cases`}
          tone={analytics.activeReports === 0 ? "green" : "rose"}
        />
        <SignalCard
          icon={TrendingUp}
          title="Peak reporting period"
          value={analytics.peakMonth}
          tone="blue"
        />
        <SignalCard
          icon={ClipboardList}
          title="Priority service area"
          value={shortReportCategory(analytics.topCategory)}
          tone="teal"
        />
        <SignalCard
          icon={ClipboardCheck}
          title="Published announcements"
          value={`${analytics.publishedAnnouncements} live posts`}
          tone="green"
        />
      </div>
      {isLoading ? <AdminLoadingOverlay label="Loading analytics..." /> : null}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
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
        <span><Icon size={20} /></span>
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
  children: React.ReactNode;
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
        <span>closed</span>
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

function MonthlyBars({ values }: { values: number[] }) {
  const maxValue = Math.max(...values, 1);

  return (
    <div className="monthly-bars">
      {values.map((value, index) => (
        <div className="monthly-bar" key={monthLabels[index]}>
          <span>{value}</span>
          <i style={{ height: `${Math.max(8, (value / maxValue) * 100)}%` }} />
          <small>{monthLabels[index]}</small>
        </div>
      ))}
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
      <span><Icon size={21} /></span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

type AnalyticsData = ReturnType<typeof buildAnalytics>;

function buildAnalytics(
  reports: CommunityReport[],
  residents: Resident[],
  announcements: Announcement[]
) {
  const monthlyReports = Array.from({ length: 12 }, () => 0);
  const categoryCounts = Object.fromEntries(categoryOrder.map((category) => [category, 0]));

  let pendingReports = 0;
  let progressReports = 0;
  let resolvedReports = 0;

  reports.forEach((report) => {
    const status = normalizeReportStatus(report.status);
    if (status === "pending") pendingReports += 1;
    if (status === "in progress") progressReports += 1;
    if (status === "resolved") resolvedReports += 1;

    const createdAt = new Date(report.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      monthlyReports[createdAt.getMonth()] += 1;
    }

    const category = normalizeReportCategory(report.category);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  });

  const totalReports = reports.length;
  const totalResidents = residents.length;
  const activeReports = pendingReports + progressReports;
  const resolutionRate = totalReports === 0 ? 0 : Math.round((resolvedReports / totalReports) * 100);
  const residentReportCoverage =
    totalResidents === 0 ? 0 : Math.round((totalReports / totalResidents) * 100);

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
  const peakMonth =
    peakMonthEntry.value === 0
      ? "No activity"
      : `${monthLabels[peakMonthEntry.index]} (${peakMonthEntry.value})`;

  return {
    activeReports,
    categoryCounts,
    draftAnnouncements: announcements.filter((item) => !item.is_published).length,
    monthlyReports,
    peakMonth,
    pendingReports,
    progressReports,
    publishedAnnouncements: announcements.filter((item) => item.is_published).length,
    residentReportCoverage,
    resolutionRate,
    resolvedReports,
    topCategory,
    totalAnnouncements: announcements.length,
    totalReports,
    totalResidents
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
