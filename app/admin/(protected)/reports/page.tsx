/* eslint-disable @next/next/no-img-element */
"use client";

import {
  CalendarClock,
  Edit3,
  ImageIcon,
  Search,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteReport,
  fetchReports,
  updateReportAdminNote,
  updateReportCategory,
  updateReportStatus
} from "@/lib/reports";
import { ImageViewer } from "@/components/image-viewer";
import { useAdminRole } from "@/components/admin-role-context";
import { canDeleteReports } from "@/lib/roles";
import {
  normalizeReportCategory,
  normalizeReportStatus,
  reportCategoryOptions,
  reportStatusLabel
} from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";

const ReportLocationMap = dynamic(
  () => import("@/components/report-location-map").then((module) => module.ReportLocationMap),
  { ssr: false }
);

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in progress" },
  { label: "Resolved", value: "resolved" }
];

const statusOptions = ["pending", "in progress", "resolved"];

export default function ReportsPage() {
  const { role } = useAdminRole();
  const canDelete = canDeleteReports(role);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(null);
  const [viewingImage, setViewingImage] = useState<{ title: string; url: string } | null>(null);
  const [editingNoteReport, setEditingNoteReport] = useState<CommunityReport | null>(null);
  const [deleteTargetReport, setDeleteTargetReport] = useState<CommunityReport | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  async function loadReports() {
    setIsLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load reports.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const stats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((report) => normalizeReportStatus(report.status) === "pending").length,
      progress: reports.filter((report) => normalizeReportStatus(report.status) === "in progress").length,
      resolved: reports.filter((report) => normalizeReportStatus(report.status) === "resolved").length
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return reports
      .filter((report) => {
        if (selectedFilter === "all") return true;
        return normalizeReportStatus(report.status) === selectedFilter;
      })
      .filter((report) => {
        if (!query) return true;

        return [
          report.description,
          report.reporter_name,
          report.category,
          report.status
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [reports, searchQuery, selectedFilter]);

  async function handleStatusChange(report: CommunityReport, status: string) {
    setIsWorking(true);
    try {
      await updateReportStatus(report.id, status);
      await loadReports();
      setMessage("Report status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update status.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCategoryChange(report: CommunityReport, category: string) {
    setIsWorking(true);
    try {
      await updateReportCategory(report.id, category);
      await loadReports();
      setMessage("Report category updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update category.");
    } finally {
      setIsWorking(false);
    }
  }

  function requestDelete(report: CommunityReport) {
    if (!canDelete) {
      setMessage("Only administrators can delete reports.");
      return;
    }

    setDeleteTargetReport(report);
  }

  async function handleDeleteConfirmed() {
    if (!deleteTargetReport) return;
    setIsWorking(true);
    try {
      await deleteReport(deleteTargetReport.id);
      await loadReports();
      setMessage("Report deleted.");
      setSelectedReport(null);
      setDeleteTargetReport(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete report.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSaveNote() {
    if (!editingNoteReport) return;

    setIsWorking(true);
    try {
      await updateReportAdminNote(editingNoteReport.id, adminNote);
      await loadReports();
      setMessage("Admin note updated.");
      setEditingNoteReport(null);
      setAdminNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save admin note.");
    } finally {
      setIsWorking(false);
    }
  }

  function openNoteDialog(report: CommunityReport) {
    setEditingNoteReport(report);
    setAdminNote(report.admin_note ?? "");
  }

  return (
    <section className="admin-page reports-page">
      <div className="page-heading">
        <p>Community reports</p>
        <h2>Active Reports</h2>
        <span>Manage and assign resident-submitted community issues.</span>
      </div>

      <div className="report-stats">
        <StatCard label="Total Active" value={stats.total} tone="dark" />
        <StatCard label="Pending Review" value={stats.pending} tone="pending" />
        <StatCard label="In Progress" value={stats.progress} tone="progress" />
        <StatCard label="Resolved" value={stats.resolved} tone="resolved" />
      </div>

      <div className="reports-toolbar">
        <div className="filter-tabs compact-tabs">
          {statusFilters.map((filter) => (
            <button
              className={selectedFilter === filter.value ? "active" : ""}
              key={filter.value}
              onClick={() => setSelectedFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="resident-search">
          <Search size={17} />
          <input
            placeholder="Search reports or residents..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
      </div>

      {message ? (
        <div className="admin-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="report-list-heading">
        <h3>Recent Submissions</h3>
        <button onClick={loadReports} type="button">Refresh</button>
      </div>

      <div className="report-list">
        {isLoading ? (
          <div className="empty-state">Loading community reports...</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">No reports found.</div>
        ) : filteredReports.length === 0 ? (
          <div className="empty-state">No reports match your current search/filter.</div>
        ) : (
          filteredReports.map((report) => (
            <ReportCard
              disabled={isWorking}
              key={report.id}
              report={report}
              onCategoryChange={handleCategoryChange}
              canDelete={canDelete}
              onDelete={requestDelete}
              onEditNote={openNoteDialog}
              onStatusChange={handleStatusChange}
              onView={setSelectedReport}
            />
          ))
        )}
      </div>

      {selectedReport ? (
        <ReportDetailsDialog
          report={selectedReport}
          canDelete={canDelete}
          onClose={() => setSelectedReport(null)}
          onDelete={requestDelete}
          onEditNote={openNoteDialog}
          onImageView={setViewingImage}
        />
      ) : null}

      {deleteTargetReport ? (
        <DeleteConfirmDialog
          report={deleteTargetReport}
          isWorking={isWorking}
          onCancel={() => setDeleteTargetReport(null)}
          onConfirm={handleDeleteConfirmed}
        />
      ) : null}

      {editingNoteReport ? (
        <AdminNoteDialog
          note={adminNote}
          report={editingNoteReport}
          isWorking={isWorking}
          onChange={setAdminNote}
          onClose={() => {
            setEditingNoteReport(null);
            setAdminNote("");
          }}
          onSave={handleSaveNote}
        />
      ) : null}

      {viewingImage ? (
        <ImageViewer
          imageUrl={viewingImage.url}
          title={viewingImage.title}
          onClose={() => setViewingImage(null)}
        />
      ) : null}
    </section>
  );
}

function ReportCard({
  canDelete,
  disabled,
  report,
  onCategoryChange,
  onDelete,
  onEditNote,
  onStatusChange,
  onView
}: {
  canDelete: boolean;
  disabled: boolean;
  report: CommunityReport;
  onCategoryChange: (report: CommunityReport, category: string) => void;
  onDelete: (report: CommunityReport) => void;
  onEditNote: (report: CommunityReport) => void;
  onStatusChange: (report: CommunityReport, status: string) => void;
  onView: (report: CommunityReport) => void;
}) {
  const status = normalizeReportStatus(report.status);
  const category = normalizeReportCategory(report.category);
  const images = reportImages(report);
  const title = report.description?.trim() || "Untitled community report";

  return (
    <article className="report-card" onClick={() => onView(report)}>
      <div className="report-image">
        {images.length > 0 ? <img src={images[0]} alt="" /> : <ImageIcon size={28} />}
      </div>
      <div className="report-body">
        <div className="report-meta">
          <span>{category.toUpperCase()}</span>
          <small><CalendarClock size={13} /> {shortDate(report.created_at)}</small>
        </div>
        <h3>{title}</h3>
        <p>{report.description?.trim() || "No description provided."}</p>
        <small className="reporter-line"><UserRound size={13} /> {report.reporter_name ?? "Unknown resident"}</small>
        <div className="report-actions" onClick={(event) => event.stopPropagation()}>
          <select
            value={category}
            disabled={disabled}
            onChange={(event) => onCategoryChange(report, event.target.value)}
          >
            {reportCategoryOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select
            className={`status-select ${status.replace(" ", "-")}`}
            value={status}
            disabled={disabled}
            onChange={(event) => onStatusChange(report, event.target.value)}
          >
            {statusOptions.map((option) => <option key={option}>{reportStatusLabel(option)}</option>)}
          </select>
          <button className="note-button" onClick={() => onEditNote(report)} type="button">
            <Edit3 size={14} /> Note
          </button>
          {canDelete ? (
            <button className="delete-button" onClick={() => onDelete(report)} type="button">
              <Trash2 size={14} /> Delete
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ReportDetailsDialog({
  canDelete,
  report,
  onClose,
  onDelete,
  onEditNote,
  onImageView
}: {
  canDelete: boolean;
  report: CommunityReport;
  onClose: () => void;
  onDelete: (report: CommunityReport) => void;
  onEditNote: (report: CommunityReport) => void;
  onImageView: (image: { title: string; url: string }) => void;
}) {
  const images = reportImages(report);
  const coordinates = formatCoordinates(report);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 220);
  }

  return (
    <div
      className={`modal-backdrop report-modal-backdrop ${isClosing ? "is-closing" : "is-opening"}`}
      role="dialog"
      aria-modal="true"
      onClick={requestClose}
    >
      <div className="report-modal" onClick={(event) => event.stopPropagation()}>
        <div className="report-modal-scroll">
          <div className="modal-header">
            <div>
              <h2>Report Details</h2>
            </div>
            <StatusBadge status={normalizeReportStatus(report.status)} />
          </div>

          {images.length > 0 ? (
            <div className="report-modal-images">
              <button onClick={() => onImageView({ title: "Report evidence", url: images[0] })} type="button">
                <img src={images[0]} alt="Report evidence" />
              </button>
              {images.length > 1 ? (
                <div>
                  {images.slice(1).map((image, index) => (
                    <button
                      key={image}
                      onClick={() => onImageView({ title: `Report evidence ${index + 2}`, url: image })}
                      type="button"
                    >
                      <img src={image} alt="Report evidence thumbnail" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="detail-grid report-detail-grid">
            <DetailItem label="Description" value={report.description || "No description provided."} />
            <DetailItem label="Reported by" value={report.reporter_name ?? "Unknown resident"} />
            <DetailItem label="Category" value={normalizeReportCategory(report.category)} />
            <DetailItem label="Status" value={reportStatusLabel(normalizeReportStatus(report.status))} />
            <DetailItem label="Date" value={shortDate(report.created_at)} />
            <DetailItem label="GPS" value={coordinates} />
            <DetailItem label="Admin note" value={report.admin_note?.trim() || "No admin note yet."} />
          </div>

          {hasCoordinates(report) ? (
            <div className="map-preview">
              <ReportLocationMap
                latitude={report.latitude as number}
                longitude={report.longitude as number}
              />
            </div>
          ) : (
            <div className="map-placeholder">No map preview available.</div>
          )}

          <div className="modal-actions">
            {canDelete ? (
              <button className="danger-admin-button" onClick={() => onDelete(report)} type="button">
                Delete
              </button>
            ) : null}
            <button className="secondary-admin-button" onClick={() => onEditNote(report)} type="button">
              Edit note
            </button>
            <button className="primary-admin-button" onClick={requestClose} type="button">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminNoteDialog({
  isWorking,
  note,
  report,
  onChange,
  onClose,
  onSave
}: {
  isWorking: boolean;
  note: string;
  report: CommunityReport;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="reject-modal">
        <div className="modal-header">
          <div>
            <h2>Admin Note</h2>
            <p>{report.reporter_name ?? "Unknown resident"}</p>
          </div>
          <button onClick={onClose} type="button" aria-label="Close"><X size={20} /></button>
        </div>
        <textarea
          className="note-textarea"
          placeholder="Add an update or note visible to the resident"
          value={note}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="modal-actions">
          <button className="secondary-admin-button" onClick={onClose} type="button">Cancel</button>
          <button className="primary-admin-button" disabled={isWorking} onClick={onSave} type="button">Save</button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  report,
  isWorking,
  onCancel,
  onConfirm
}: {
  report: CommunityReport;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="reject-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Delete Report</h2>
            <p>
              Delete this report from {report.reporter_name ?? "Unknown resident"}?
            </p>
          </div>
          <button onClick={onCancel} type="button" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal-actions">
          <button className="secondary-admin-button" onClick={onCancel} type="button">Cancel</button>
          <button className="danger-admin-button" disabled={isWorking} onClick={onConfirm} type="button">
            {isWorking ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`report-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status.replace(" ", "-")}`}>{reportStatusLabel(status)}</span>;
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

function hasCoordinates(report: CommunityReport) {
  return typeof report.latitude === "number" && typeof report.longitude === "number";
}

function formatCoordinates(report: CommunityReport) {
  if (!hasCoordinates(report)) return "No GPS location";

  return `Lat ${report.latitude?.toFixed(6)}, Lng ${report.longitude?.toFixed(6)}`;
}

function shortDate(value?: string) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
