/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";
import {
  ClipboardList,
  LocateFixed,
  MapPinned,
  RefreshCw,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteReport, fetchReports } from "@/lib/reports";
import { useAdminRole } from "@/components/admin-role-context";
import { canDeleteReports } from "@/lib/roles";
import {
  normalizeReportCategory,
  normalizeReportStatus,
  reportStatusLabel,
  shortReportCategory
} from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";

const ComplaintMap = dynamic(
  () => import("@/components/complaint-map").then((module) => module.ComplaintMap),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading map...</div>
  }
);

const categories = [
  "all",
  "Road Damage",
  "Garbage Collection",
  "Broken Streetlight",
  "Drainage Issue",
  "Noise Complaint",
  "Others"
];

const statusFilters = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in progress" },
  { label: "Resolved", value: "resolved" }
];

export default function ComplaintMapPage() {
  const { role } = useAdminRole();
  const canDelete = canDeleteReports(role);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadReports() {
    setIsLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
      setSelectedReport((current) =>
        current && data.some((report) => report.id === current.id) ? current : null
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load complaint map data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const mappedReports = useMemo(() => reports.filter(hasLocation), [reports]);

  const visibleReports = useMemo(() => {
    return mappedReports.filter((report) => {
      const status = normalizeReportStatus(report.status);
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" ? status !== "resolved" : status === selectedStatus);
      const matchesCategory =
        selectedCategory === "all" || normalizeReportCategory(report.category) === selectedCategory;

      return matchesStatus && matchesCategory;
    });
  }, [mappedReports, selectedCategory, selectedStatus]);

  const metrics = useMemo(() => {
    return {
      pending: reports.filter((report) => normalizeReportStatus(report.status) === "pending").length,
      progress: reports.filter((report) => normalizeReportStatus(report.status) === "in progress").length,
      resolved: reports.filter((report) => normalizeReportStatus(report.status) === "resolved").length,
      mapped: mappedReports.length
    };
  }, [mappedReports.length, reports]);

  async function handleDelete(report: CommunityReport) {
    if (!canDelete) {
      setMessage("Only administrators can delete reports.");
      return;
    }

    const shouldDelete = window.confirm(
      `Delete this report from ${report.reporter_name ?? "Unknown resident"}?`
    );
    if (!shouldDelete) return;

    try {
      await deleteReport(report.id);
      setMessage("Report deleted.");
      setSelectedReport(null);
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete report.");
    }
  }

  const activeSelectedReport =
    selectedReport && visibleReports.some((report) => report.id === selectedReport.id)
      ? selectedReport
      : null;

  return (
    <section className="map-page">
      <div className="map-command-header">
        <div>
          <h2>Complaint Map</h2>
          <p>Geographic command view for active resident-submitted issues.</p>
        </div>
        <div className="map-header-pills">
          <HeaderPill icon={LocateFixed} label="Visible Pins" value={visibleReports.length.toString()} />
          <HeaderPill icon={ClipboardList} label="Total Cases" value={reports.length.toString()} />
          <button aria-label="Refresh map" onClick={loadReports} type="button">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {message ? (
        <div className="admin-message map-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="map-control-deck">
        <div className="map-metrics">
          <MapMetric label="Pending Review" value={metrics.pending} tone="pending" />
          <MapMetric label="In Progress" value={metrics.progress} tone="progress" />
          <MapMetric label="Resolved" value={metrics.resolved} tone="resolved" />
          <MapMetric label="Mapped Reports" value={metrics.mapped} tone="mapped" />
        </div>
        <div className="map-filters">
          <h3>Filters</h3>
          <div>
            {statusFilters.map((filter) => (
              <button
                className={selectedStatus === filter.value ? "active" : ""}
                key={filter.value}
                onClick={() => setSelectedStatus(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div>
            {categories.map((category) => (
              <button
                className={selectedCategory === category ? "active" : ""}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category === "all" ? "All Categories" : shortReportCategory(category)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="map-workspace">
        <div className="map-canvas">
          {isLoading ? (
            <div className="map-loading">Loading complaint map data...</div>
          ) : (
            <>
              <ComplaintMap
                reports={visibleReports}
                selectedReport={activeSelectedReport}
                onSelect={setSelectedReport}
              />
              <MapLegend />
              {visibleReports.length === 0 ? (
                <div className="empty-map-overlay">
                  <MapPinned size={32} />
                  <strong>No mapped complaints match the selected filters.</strong>
                </div>
              ) : null}
            </>
          )}
        </div>
        <aside className="map-side-panel">
          {activeSelectedReport ? (
            <ReportDetailsPanel
              report={activeSelectedReport}
              canDelete={canDelete}
              onClose={() => setSelectedReport(null)}
              onDelete={handleDelete}
            />
          ) : (
            <ReportQueuePanel reports={visibleReports} onSelect={setSelectedReport} />
          )}
        </aside>
      </div>
    </section>
  );
}

function HeaderPill({
  icon: Icon,
  label,
  value
}: {
  icon: typeof LocateFixed;
  label: string;
  value: string;
}) {
  return (
    <span className="map-header-pill">
      <Icon size={18} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </span>
  );
}

function MapMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`map-metric ${tone}`}>
      <span>{value}</span>
      <strong>{label}</strong>
    </article>
  );
}

function MapLegend() {
  return (
    <div className="map-legend">
      <strong>Pin Status</strong>
      <span><i className="pending" /> Pending</span>
      <span><i className="progress" /> In Progress</span>
      <span><i className="resolved" /> Resolved</span>
    </div>
  );
}

function ReportQueuePanel({
  reports,
  onSelect
}: {
  reports: CommunityReport[];
  onSelect: (report: CommunityReport) => void;
}) {
  return (
    <div className="queue-panel">
      <h3>Mapped Complaint Queue</h3>
      <p>Select a map pin or queue item to inspect complaint details.</p>
      <div className="queue-list">
        {reports.length === 0 ? (
          <div className="queue-empty">No mapped reports match this view.</div>
        ) : (
          reports.map((report) => (
            <button key={report.id} onClick={() => onSelect(report)} type="button">
              <span>
                <strong>{shortReportCategory(report.category)}</strong>
                <StatusMini status={normalizeReportStatus(report.status)} />
              </span>
              <p>{report.description?.trim() || "No description provided."}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ReportDetailsPanel({
  canDelete,
  report,
  onClose,
  onDelete
}: {
  canDelete: boolean;
  report: CommunityReport;
  onClose: () => void;
  onDelete: (report: CommunityReport) => void;
}) {
  const images = reportImages(report);

  return (
    <div className="map-details-panel">
      <div className="map-details-head">
        <div>
          <h3>{shortReportCategory(report.category)}</h3>
          <div>
            <StatusMini status={normalizeReportStatus(report.status)} />
            <StatusMini status={shortDate(report.created_at)} variant="date" />
          </div>
        </div>
        <button onClick={onClose} type="button" aria-label="Close details">
          <X size={20} />
        </button>
      </div>
      <div className="map-details-scroll">
        {images.length > 0 ? (
          <>
            <a className="map-primary-image" href={images[0]} target="_blank" rel="noreferrer">
              <img src={images[0]} alt="Report evidence" />
            </a>
            {images.length > 1 ? (
              <div className="map-image-strip">
                {images.slice(1).map((image) => (
                  <a href={image} key={image} target="_blank" rel="noreferrer">
                    <img src={image} alt="Report evidence thumbnail" />
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <p className="map-description">
          {report.description?.trim() || "No description provided."}
        </p>
        <Detail label="Reported by" value={report.reporter_name ?? "Unknown resident"} />
        <Detail label="GPS" value={`Lat ${report.latitude?.toFixed(6)}, Lng ${report.longitude?.toFixed(6)}`} />
        {report.admin_note?.trim() ? <Detail label="Admin note" value={report.admin_note.trim()} /> : null}
        <a
          className="open-map-link"
          href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned size={17} /> Open in OpenStreetMap
        </a>
        {canDelete ? (
          <button className="map-delete-button" onClick={() => onDelete(report)} type="button">
            <Trash2 size={17} /> Delete Report
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="map-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusMini({
  status,
  variant
}: {
  status: string;
  variant?: "date";
}) {
  const label = variant === "date" ? status : statusLabel(status);
  const className = variant === "date" ? "date" : status.replace(" ", "-");

  return <em className={`map-status-mini ${className}`}>{label}</em>;
}

function hasLocation(report: CommunityReport) {
  return typeof report.latitude === "number" && typeof report.longitude === "number";
}

function statusLabel(status: string) {
  return reportStatusLabel(status);
}

function reportImages(report: CommunityReport) {
  const urls = new Set<string>();
  const addUrl = (value: unknown) => {
    const url = value?.toString().trim();
    if (url) urls.add(url);
  };

  addUrl(report.image_url);

  if (Array.isArray(report.image_urls)) {
    report.image_urls.forEach(addUrl);
  } else if (typeof report.image_urls === "string") {
    const text = report.image_urls.trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) parsed.forEach(addUrl);
      } catch {
        addUrl(text);
      }
    } else {
      addUrl(text);
    }
  }

  return Array.from(urls);
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
