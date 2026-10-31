/* eslint-disable @next/next/no-img-element */
"use client";
import { markOfficeNotificationRead } from "@/lib/notifications";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";

import { Modal } from "@/components/modal";
import { ReportCategoryIcon } from "@/components/report-category-icon";
import { UiDropdown } from "@/components/ui-dropdown";
import { RefreshButton } from "@/components/workspace-ui";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  MapPinned,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "@/components/crm-icons";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { deleteReport, fetchReports } from "@/lib/reports";
import { useAdminRole } from "@/components/admin-role-context";
import { canDeleteReports } from "@/lib/roles";
import {
  hasValidReportLocation,
  normalizeReportCategory,
  normalizeReportStatus,
  reportStatusLabel,
  shortReportCategory,
} from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";

const ComplaintMap = dynamic(
  () =>
    import("@/components/complaint-map").then((module) => module.ComplaintMap),
  {
    ssr: false,
    loading: () => <div className="page-skeleton-map" role="status" aria-label="Loading map">Loading map…</div>,
  },
);

const categories = [
  "all",
  "Road Damage",
  "Garbage Collection",
  "Broken Streetlight",
  "Drainage Issue",
  "Noise Complaint",
  "Others",
];

const statusFilters = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in progress" },
  { label: "Resolved", value: "resolved" },
];

export default function ComplaintMapPage() {
  const { role } = useAdminRole();
  const canDelete = canDeleteReports(role);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(
    null,
  );
  const [imageViewer, setImageViewer] = useState<{
    images: string[];
    index: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommunityReport | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    baseOffsetX: number;
    baseOffsetY: number;
  } | null>(null);

  async function loadReports() {
    setIsLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
      setSelectedReport(
        (current) => data.find((report) => report.id === current?.id) ?? null,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load complaint map data.",
      );
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  useEffect(() => {
    if (selectedReport?.id) void markOfficeNotificationRead("reports", selectedReport.id);
  }, [selectedReport?.id]);

  const mappedReports = useMemo(() => reports.filter(hasLocation), [reports]);

  const visibleReports = useMemo(() => {
    return mappedReports.filter((report) => {
      const status = normalizeReportStatus(report.status);
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active"
          ? status !== "resolved"
          : status === selectedStatus);
      const matchesCategory =
        selectedCategory === "all" ||
        normalizeReportCategory(report.category) === selectedCategory;

      return matchesStatus && matchesCategory;
    });
  }, [mappedReports, selectedCategory, selectedStatus]);

  async function handleDelete(report: CommunityReport) {
    if (isDeleting) return;
    if (!canDelete) {
      setMessage("Only administrators can delete reports.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteReport(report.id);
      setDeleteTarget(null);
      setMessage("Report deleted.");
      setSelectedReport(null);
      await loadReports();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to delete report.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const activeSelectedReport =
    selectedReport &&
    visibleReports.some((report) => report.id === selectedReport.id)
      ? selectedReport
      : null;

  function openImageViewer(images: string[], index: number) {
    if (!images[index]) return;
    setImageViewer({
      images,
      index,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
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
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      };
    });
  }

  function changeZoom(delta: number) {
    setImageViewer((current) => {
      if (!current) return current;
      const nextZoom = Math.min(
        3,
        Math.max(1, Number((current.zoom + delta).toFixed(2))),
      );
      return {
        ...current,
        zoom: nextZoom,
        offsetX: nextZoom === 1 ? 0 : current.offsetX,
        offsetY: nextZoom === 1 ? 0 : current.offsetY,
      };
    });
  }

  function resetZoom() {
    setImageViewer((current) =>
      current
        ? {
            ...current,
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          }
        : current,
    );
  }

  function handleImageWheel(event: WheelEvent<HTMLDivElement>) {
    if (!imageViewer) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 0.2 : -0.2);
  }

  function handleImageDragStart(event: PointerEvent<HTMLDivElement>) {
    if (!imageViewer || imageViewer.zoom <= 1) return;

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseOffsetX: imageViewer.offsetX,
      baseOffsetY: imageViewer.offsetY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleImageDragMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const nextOffsetX =
      dragState.baseOffsetX + (event.clientX - dragState.startX);
    const nextOffsetY =
      dragState.baseOffsetY + (event.clientY - dragState.startY);

    setImageViewer((current) =>
      current
        ? {
            ...current,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
          }
        : current,
    );
  }

  function handleImageDragEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  }

  if (!hasLoaded) return <AdminPageSkeleton href="/admin/map" />;

  return (
    <section className="map-page">
      {reports.length > mappedReports.length ? (
        <p className="map-location-note">{reports.length - mappedReports.length} reports have no valid location. <a href="/admin/reports">View in Community Reports</a></p>
      ) : null}

      {message && !deleteTarget ? (
        <div className="admin-message map-message" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="map-compact-toolbar" role="group" aria-label="Map filters">
        <div className="map-compact-field"><span>Status</span><UiDropdown ariaLabel="Filter map by status" value={selectedStatus} options={statusFilters} onChange={setSelectedStatus} /></div>
        <div className="map-compact-field"><span>Category</span><UiDropdown ariaLabel="Filter map by category" value={selectedCategory} options={categories.map(value => ({ value, label: value === "all" ? "All categories" : shortReportCategory(value), icon: <ReportCategoryIcon category={value} /> }))} onChange={setSelectedCategory} /></div>
        <MapLegend />
        <RefreshButton loading={isLoading} onClick={loadReports} />
      </div>

      <div className="map-workspace">
        <div className="map-canvas">
          <>
            <ComplaintMap
              reports={visibleReports}
              selectedReport={activeSelectedReport}
              onSelect={setSelectedReport}
            />
            {visibleReports.length === 0 ? (
              <div className="empty-map-overlay">
                <span className="map-empty-icon" aria-hidden="true"><MapPinned size={24} /></span>
                <div role="status">
                  <h2>{mappedReports.length ? "No matching complaints" : "No mapped complaints yet"}</h2>
                  <p>{mappedReports.length ? "Try another status or category to see more reports." : "Reports with a valid location will appear here."}</p>
                </div>
                {mappedReports.length > 0 ? (
                  <button type="button" className="secondary-admin-button" onClick={() => { setSelectedStatus("all"); setSelectedCategory("all"); }}>Reset filters</button>
                ) : null}
              </div>
            ) : null}
          </>
        </div>
        <aside className="map-side-panel">
          {activeSelectedReport ? (
            <ReportDetailsPanel
              report={activeSelectedReport}
              canDelete={canDelete && !isDeleting}
              onClose={() => setSelectedReport(null)}
              onDelete={(report) => { setMessage(""); setDeleteTarget(report); }}
              onPreviewImage={openImageViewer}
            />
          ) : (
            <ReportQueuePanel
              reports={visibleReports}
              onSelect={setSelectedReport}
            />
          )}
        </aside>
      </div>

      {deleteTarget ? <Modal title="Delete report" dismissible={!isDeleting} onClose={() => setDeleteTarget(null)} className="staff-account-dialog">
        <div className="reject-modal">
          <div className="modal-header"><div><h2>Delete report?</h2><p>This permanently removes the report from {deleteTarget.reporter_name || "this resident"}. This cannot be undone.</p></div><button type="button" aria-label="Close confirmation" disabled={isDeleting} onClick={() => setDeleteTarget(null)}><X size={20} /></button></div>
          {message ? <div className="admin-message" role="alert">{message}</div> : null}
          <div className="modal-actions"><button type="button" className="secondary-admin-button" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="danger-admin-button" disabled={isDeleting} onClick={() => void handleDelete(deleteTarget)}>{isDeleting ? "Deleting…" : "Delete report"}</button></div>
        </div>
      </Modal> : null}

      {imageViewer ? (
        <Modal
          title="Complaint evidence"
          onClose={closeImageViewer}
          className="map-image-modal-backdrop"
        >
          <div
            className="map-image-modal"
            onClick={(event) => event.stopPropagation()}
            aria-label="Complaint image preview"
          >
            <div className="map-image-toolbar">
              <div className="map-image-counter">
                Image {imageViewer.index + 1} of {imageViewer.images.length}
              </div>
              <div className="map-image-toolbar-actions">
                <button
                  onClick={() => changeZoom(-0.25)}
                  type="button"
                  aria-label="Zoom out"
                >
                  <Minus size={18} />
                </button>
                <span>{Math.round(imageViewer.zoom * 100)}%</span>
                <button
                  onClick={() => changeZoom(0.25)}
                  type="button"
                  aria-label="Zoom in"
                >
                  <Plus size={18} />
                </button>
                <button
                  onClick={resetZoom}
                  type="button"
                  aria-label="Reset zoom"
                >
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
            <div
              className={`map-image-stage ${imageViewer.zoom > 1 ? "is-zoomed" : ""}`}
              onPointerDown={handleImageDragStart}
              onPointerMove={handleImageDragMove}
              onPointerUp={handleImageDragEnd}
              onPointerCancel={handleImageDragEnd}
              onWheel={handleImageWheel}
            >
              <img
                src={imageViewer.images[imageViewer.index]}
                alt="Complaint evidence preview"
                draggable={false}
                style={{
                  transform: `translate(${imageViewer.offsetX}px, ${imageViewer.offsetY}px) scale(${imageViewer.zoom})`,
                }}
              />
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function MapLegend() {
  return (
    <div className="map-legend" role="group" aria-label="Report status legend">
      <strong>Report status</strong>
      <div className="map-legend-items">
        <span><i className="pending" aria-hidden="true" />Pending</span>
        <span><i className="progress" aria-hidden="true" />In progress</span>
        <span><i className="resolved" aria-hidden="true" />Resolved</span>
      </div>
    </div>
  );
}

function ReportQueuePanel({
  reports,
  onSelect,
}: {
  reports: CommunityReport[];
  onSelect: (report: CommunityReport) => void;
}) {
  return (
    <div className="queue-panel">
      <div className="queue-panel-header">
        <div>
          <h3>Mapped reports</h3>
          <p>Select a report to view its details.</p>
        </div>
        <span className="queue-count">{reports.length}</span>
      </div>
      <div className="queue-list">
        {reports.length === 0 ? (
          <div className="queue-empty">No mapped reports match this view.</div>
        ) : (
          reports.map((report) => (
            <button
              key={report.id}
              onClick={() => onSelect(report)}
              type="button"
            >
              <span>
                <strong className="map-category-label"><ReportCategoryIcon category={report.category} />{shortReportCategory(report.category)}</strong>
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
  onPreviewImage,
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
          <h3 className="map-category-label"><ReportCategoryIcon category={report.category} />{shortReportCategory(report.category)}</h3>
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
        <Detail
          label="Reported by"
          value={report.reporter_name ?? "Unknown resident"}
        />
        <Detail
          label="GPS"
          value={`Lat ${report.latitude?.toFixed(6)}, Lng ${report.longitude?.toFixed(6)}`}
        />
        {report.admin_note?.trim() ? (
          <Detail label="Staff note" value={report.admin_note.trim()} />
        ) : null}
        <a
          className="open-map-link"
          href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned size={17} /> Open in OpenStreetMap
        </a>
        {canDelete ? (
          <button
            className="map-delete-button"
            onClick={() => onDelete(report)}
            type="button"
          >
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

function StatusMini({ status, variant }: { status: string; variant?: "date" }) {
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
    year: "numeric",
  });
}
