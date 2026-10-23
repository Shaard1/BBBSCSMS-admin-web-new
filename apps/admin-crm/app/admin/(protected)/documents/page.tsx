"use client";
import { markOfficeNotificationRead } from "@/lib/notifications";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";

import {DocumentRequestDialog} from "@/components/document-request-dialog";
import { PageHeader } from "@/components/workspace-ui";
import { FileBadge2, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchDocumentRequests,

  summarizeDocumentRequests,
  updateDocumentRequestStatus,
} from "@/lib/document-requests";
import type { DocumentReview } from "@/lib/document-workflow";

import type { DocumentRequest, DocumentRequestStatus } from "@/lib/types";

const filters = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Legacy payment pending", value: "awaiting_payment" },
  { label: "Processing", value: "processing" },
  { label: "Ready for Release", value: "ready_for_release" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
] as const;

type FilterValue = (typeof filters)[number]["value"];

export default function DocumentRequestsPage() {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRequest =
    requests.find((request) => request.id === selectedId) ?? null;

  const stats = useMemo(() => summarizeDocumentRequests(requests), [requests]);
  const filteredRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesFilter =
        selectedFilter === "all" ? true : request.status === selectedFilter;

      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      const searchableText = [
        request.resident_name,
        request.certificate_title,
        request.certificate_variant,
        request.contact_number,
        request.email,
        request.address,
        request.purpose,
        request.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [requests, searchQuery, selectedFilter]);

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    if (selectedRequest?.id) void markOfficeNotificationRead("documents", selectedRequest.id);
  }, [selectedRequest?.id]);

  async function loadRequests() {
    setIsLoading(true);

    try {
      const data = await fetchDocumentRequests();
      setRequests(data);
      const target=new URLSearchParams(window.location.search).get("request");
      if(target&&data.some(item=>item.id===target))setSelectedId(target);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load document requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(
    request: DocumentRequest,
    status: DocumentRequestStatus,
    rejectionReason?: string,
    review?: DocumentReview,
  ) {
    if (isWorking || !review) return;
    if (status === "rejected" && !rejectionReason?.trim()) return;

    setIsWorking(true);
    setMessage("");

    try {
      await updateDocumentRequestStatus(
        request.id,
        status,
        request.status,
        rejectionReason,
        review,
      );
      await loadRequests();
      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status,
                rejection_reason:
                  status === "rejected" ? rejectionReason : undefined,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      setMessage(
        status === request.status ? "Review details saved." : `Request updated to ${statusLabel(status)}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the document request.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading && requests.length === 0) return <AdminPageSkeleton href="/admin/documents" />;

  return (
    <section className="admin-page reports-page documents-page">
      <PageHeader
        title="Document requests"
        description="Review applications, track payments, and prepare documents for release."
      />

      <div className="report-stats documents-stats">
        <StatCard label="Total Requests" tone="dark" value={stats.total} />
        <StatCard label="Pending Review" tone="pending" value={stats.pending} />
        <StatCard
          label="Awaiting Payment"
          tone="progress"
          value={stats.awaitingPayment}
        />
        <StatCard label="Processing" tone="progress" value={stats.processing} />
        <StatCard
          label="Ready for Release"
          tone="resolved"
          value={stats.readyForRelease}
        />
        <StatCard label="Completed" tone="resolved" value={stats.completed} />
      </div>

      <div className="reports-toolbar">
        <div className="filter-tabs compact-tabs">
          {filters.map((filter) => (
            <button
              aria-pressed={selectedFilter === filter.value}
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
            aria-label="Search document requests"
            placeholder="Search name, document, or request ID…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
      </div>

      {message ? (
        <div className="admin-message" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="resident-panel resident-panel-improved document-requests-panel">
        <div className="resident-panel-heading resident-panel-heading-improved">
          <div>
            <h3>Submitted Requests</h3>
            <p>
              Open a request to review the resident details, form values, and
              payment preference.
            </p>
          </div>
          <button disabled={isLoading} onClick={loadRequests} type="button">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="document-request-list">
          {requests.length === 0 && !isLoading ? (
            <div className="empty-state">No document requests found.</div>
          ) : filteredRequests.length === 0 && !isLoading ? (
            <div className="empty-state">
              No document requests match your current search/filter.
            </div>
          ) : (
            filteredRequests.map((request) => (
              <article className="document-request-card" key={request.id}>
                <div className="document-request-summary">
                  <div className="document-request-identity">
                    <span className="document-request-icon">
                      <FileBadge2 size={20} />
                    </span>
                    <div>
                      <strong>{request.certificate_title}</strong>
                      <p>{request.resident_name}</p>
                      <small>{formatDateTime(request.created_at)}</small>
                    </div>
                  </div>

                  <div className="document-request-meta">
                    <span
                      className={`status-badge ${statusClassName(request.status)}`}
                    >
                      {statusLabel(request.status)}
                    </span>
                    <button
                      className="secondary-admin-button"
                      onClick={() => {
                        setMessage("");
                        setSelectedId(request.id);
                      }}
                      type="button"
                    >
                      View details
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
      {selectedRequest ? (
        <DocumentRequestDialog
          message={message}
          isWorking={isWorking}
          request={selectedRequest}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <article className={`report-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function statusLabel(status: DocumentRequestStatus) {
  switch (status) {
    case "awaiting_payment":
      return "Awaiting Payment";
    case "processing":
      return "Processing";
    case "ready_for_release":
      return "Ready for Release";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

function statusClassName(status: DocumentRequestStatus) {
  switch (status) {
    case "completed":
      return "approved";
    case "rejected":
      return "flagged";
    case "processing":
    case "ready_for_release":
      return "info";
    default:
      return "pending";
  }
}

function formatDateTime(value?: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
