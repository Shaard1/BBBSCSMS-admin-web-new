/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LocateFixed,
  MapPinned,
  RotateCcw,
  RefreshCw,
  SearchPlus,
  SearchMinus,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteReport, fetchReports } from "@/lib/reports";
import { useAdminRole } from "@/components/admin-role-context";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { canDeleteReports } from "@/lib/roles";
import {
  hasValidReportLocation,
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
    loading: () => <AdminLoadingOverlay label="Loading map..." />
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
  const [imageViewer, setImageViewer] = useState<{
    images: string[];
    index: number;
    zoom: number;
  } | null>(null);
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

  function openImageViewer(images: string[], index: number) {
    if (!images[index]) return;
    setImageViewer({
      images,
      index,
      zoom: 1
    });
  }

  function closeImageViewer() {
    setImageViewer(null);
  }

  function changeImage(step: number) {
    setImageViewer((current) => {
      if (!current) return current;
      const count = current.images.length;
      const nextIndex = (current.index + step + count) % count;
      return {
        ...current,
        index: nextIndex,
        zoom: 1
      };
    });
  }

  function changeZoom(delta: number) {
    setImageViewer((current) => {
      if (!current) return current;
      const nextZoom = Math.min(3, Math.max(1, Number((current.zoom + delta).toFixed(2))));
      return {
        ...current,
        zoom: nextZoom
      };
    });
  }

  function resetZoom() {
    setImageViewer((current) => (current ? { ...current, zoom: 1 } : current));
  }

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
          <div className="map-filters-header">
            <div>
              <h3>Filter Complaints</h3>
              <p>Narrow the map view by report status and issue category.</p>
            </div>
            <span className="map-filter-summary">
              Showing {visibleReports.length} of {mappedReports.length} mapped reports
            </span>
          </div>
          <section className="map-filter-group">
            <span className="map-filter-label">Status</span>
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
          </section>
          <section className="map-filter-group">
            <span className="map-filter-label">Category</span>
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
          </section>
        </div>
      </div>

      <div className="map-workspace">
        <div className="map-canvas">
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
            {isLoading ? <AdminLoadingOverlay label="Loading complaint map data..." /> : null}
          </>
        </div>
        <aside className="map-side-panel">
          {activeSelectedReport ? (
            <ReportDetailsPanel
              report={activeSelectedReport}
              canDelete={canDelete}
              onClose={() => setSelectedReport(null)}
              onDelete={handleDelete}
              onPreviewImage={openImageViewer}
            />
          ) : (
            <ReportQueuePanel reports={visibleReports} onSelect={setSelectedReport} />
          )}
        </aside>
      </div>

      {imageViewer ? (
        <div
          className="modal-backdrop map-image-modal-backdrop"
          onClick={closeImageViewer}
          role="presentation"
        >
          <div
            className="map-image-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Complaint image preview"
          >
            <div className="map-image-toolbar">
              <div className="map-image-counter">
                Image {imageViewer.index + 1} of {imageViewer.images.length}
              </div>
              <div className="map-image-toolbar-actions">
                <button onClick={() => changeZoom(-0.25)} type="button" aria-label="Zoom out">
                  <SearchMinus size={18} />
                </button>
                <span>{Math.round(imageViewer.zoom * 100)}%</span>
                <button onClick={() => changeZoom(0.25)} type="button" aria-label="Zoom in">
                  <SearchPlus size={18} />
                </button>
                <button onClick={resetZoom} type="button" aria-label="Reset zoom">
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            {imageViewer.images.length > 1 ? (
              <>
                <button
                  className="map-image-nav prev"
                  onClick={() => changeImage(-1)}
                  type="button"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  className="map-image-nav next"
                  onClick={() => changeImage(1)}
                  type="button"
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            ) : null}

            <button
              className="map-image-modal-close"
              onClick={closeImageViewer}
              type="button"
              aria-label="Close image preview"
            >
              <X size={20} />
            </button>
            <div className="map-image-stage">
              <img
                src={imageViewer.images[imageViewer.index]}
                alt="Complaint evidence preview"
                style={{ transform: `scale(${imageViewer.zoom})` }}
              />
            </div>
          </div>
        </div>
      ) : null}
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
      <div className="queue-panel-header">
        <div>
          <h3>Mapped Complaint Queue</h3>
          <p>Select a map pin or queue item to inspect complaint details.</p>
        </div>
        <span className="queue-count">{reports.length}</span>
      </div>
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
              <small>{shortDate(report.created_at)}</small>
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
  onDelete,
  onPreviewImage
}: {
  canDelete: boolean;
  report: CommunityReport;
  onClose: () => void;
  onDelete: (report: CommunityReport) => void;
  onPreviewImage: (images: string[], index: number) => void;
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
            <button
              className="map-primary-image"
              onClick={() => onPreviewImage(images, 0)}
              type="button"
            >
              <img src={images[0]} alt="Report evidence" />
            </button>
            {images.length > 1 ? (
              <div className="map-image-strip">
                {images.slice(1).map((image, index) => (
                  <button
                    key={image}
                    onClick={() => onPreviewImage(images, index + 1)}
                    type="button"
                  >
                    <img src={image} alt="Report evidence thumbnail" />
                  </button>
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
  return hasValidReportLocation(report.latitude, report.longitude);
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
