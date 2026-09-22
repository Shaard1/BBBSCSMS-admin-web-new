"use client";
import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  Panel,
  Metric,
  Notice,
  RefreshButton,
} from "@/components/workspace-ui";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { fetchReports } from "@/lib/reports";
import { fetchResidents } from "@/lib/residents";
import { monthlyActivity, reportSnapshot } from "@/lib/workspace-metrics";
import type { CommunityReport, Resident } from "@/lib/types";
const monthNames = [
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
  "Dec",
];
export default function AnalyticsPage() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  async function load() {
    setIsLoading(true);
    setMessage("");
    try {
      const [r, u] = await Promise.all([fetchReports(), fetchResidents()]);
      setReports(r);
      setResidents(u);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load analytics. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const data = useMemo(() => reportSnapshot(reports), [reports]);
  const months = useMemo(
    () => monthlyActivity(reports, residents, year),
    [reports, residents, year],
  );
  const years = [
    ...new Set([
      new Date().getFullYear(),
      ...reports.map((r) => new Date(r.created_at).getFullYear()),
      ...residents.map((r) => new Date(r.created_at).getFullYear()),
    ]),
  ]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const max = Math.max(1, ...months.flatMap((m) => [m.reports, m.residents]));
  const reportTotal = months.reduce((n, m) => n + m.reports, 0);
  const residentTotal = months.reduce((n, m) => n + m.residents, 0);
  return (
    <section
      className="workspace-page analytics-workspace"
      aria-busy={isLoading}
    >
      <PageHeader
        title="Service analytics"
        description="Understand demand, track follow-through, and plan community services."
      >
        <RefreshButton loading={isLoading} onClick={load} />
      </PageHeader>
      <Notice message={message} onDismiss={() => setMessage("")} />
      {isLoading ? (
        <AdminLoadingOverlay label="Loading service analytics…" />
      ) : null}
      <p className="section-kicker">
        Current snapshot · all recorded submissions
      </p>
      <div className="workspace-metrics">
        <Metric
          label="Community reports"
          value={reports.length}
          note={`${data.open} still open`}
        />
        <Metric
          label="Resolution rate"
          value={`${data.resolutionRate}%`}
          note={`${data.resolved} resolved reports`}
          tone="green"
        />
        <Metric
          label="Resident registrations"
          value={residents.length}
          note={`${residents.filter((r) => r.status === "pending").length} awaiting verification`}
          tone="teal"
        />
        <Metric
          label="Open over 7 days"
          value={data.overdue}
          note="Based on submission date, not an SLA"
          tone="amber"
        />
      </div>
      <Panel
        title="Monthly activity"
        description={`Submissions created in ${year}. Changing the year affects this chart only.`}
        action={
          <label className="year-picker">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="chart-key">
          <span>
            <i className="report-key" />
            Reports <strong>{reportTotal}</strong>
          </span>
          <span>
            <i className="resident-key" />
            Registrations <strong>{residentTotal}</strong>
          </span>
          <small>Scale: 0–{max} submissions</small>
        </div>
        <div
          className="activity-chart"
          role="img"
          aria-label={`Monthly submissions in ${year}: ${reportTotal} reports and ${residentTotal} registrations. Exact monthly values are in the table below.`}
        >
          {months.map((m, i) => (
            <div className="activity-month" key={i}>
              <div className="activity-bars">
                <div
                  className="activity-bar report-bar"
                  style={{ height: `${(m.reports / max) * 100}%` }}
                  title={`${monthNames[i]}: ${m.reports} reports`}
                />
                <div
                  className="activity-bar resident-bar"
                  style={{ height: `${(m.residents / max) * 100}%` }}
                  title={`${monthNames[i]}: ${m.residents} registrations`}
                />
              </div>
              <span>{monthNames[i]}</span>
            </div>
          ))}
        </div>
        {!reportTotal && !residentTotal ? (
          <p className="chart-empty">No submissions recorded for {year}.</p>
        ) : null}
        <details className="chart-data">
          <summary>View monthly data table</summary>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Monthly activity data"
          >
            <table>
              <caption>Monthly activity, {year}</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Reports</th>
                  <th scope="col">Registrations</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr key={i}>
                    <th scope="row">{monthNames[i]}</th>
                    <td>{m.reports}</td>
                    <td>{m.residents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>
      <div className="overview-columns">
        <Panel
          title="Report status"
          description="All reports, grouped by their current status."
        >
          <div className="distribution-rows">
            {[
              ["Pending", data.pending, "amber"],
              ["In progress", data.progress, "blue"],
              ["Resolved", data.resolved, "green"],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <div>
                  <span>{label}</span>
                  <strong>
                    {value}{" "}
                    <small>
                      (
                      {reports.length
                        ? Math.round((Number(value) / reports.length) * 100)
                        : 0}
                      %)
                    </small>
                  </strong>
                </div>
                <div className="distribution-track">
                  <i
                    className={String(tone)}
                    style={{
                      width: `${reports.length ? (Number(value) / reports.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Reports by category"
          description="Identify the concerns residents raise most often."
        >
          <div className="distribution-rows">
            {data.categories.length ? (
              data.categories.map(([label, value]) => (
                <div key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                  <div className="distribution-track">
                    <i
                      className="blue"
                      style={{
                        width: `${(value / Math.max(1, reports.length)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No categories to show yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}
