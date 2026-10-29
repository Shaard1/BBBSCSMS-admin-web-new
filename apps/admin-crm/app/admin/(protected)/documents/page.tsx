"use client";
import { markOfficeNotificationRead } from "@/lib/notifications";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";

import {DocumentRequestDialog} from "@/components/document-request-dialog";
import { FileBadge2, Search } from "lucide-react";
import { UiDropdown } from "@/components/ui-dropdown";
import { RefreshButton } from "@/components/workspace-ui";
import { useEffect, useMemo, useState } from "react";
import {
  fetchDocumentRequests,

  updateDocumentRequestStatus,
  reopenDocumentRequest,
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRequest =
    requests.find((request) => request.id === selectedId) ?? null;

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
          : "Unable to load certificate requests.",
      );
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
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
      setMessage(
        status === request.status ? "Review details saved." : `Request updated to ${statusLabel(status)}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the certificate request.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleReopen(request: DocumentRequest, reason: string): Promise<boolean> {
    if (isWorking) return false;
    setIsWorking(true);
    setMessage('');
    try {
      await reopenDocumentRequest(request, reason);
      const freshRequests = await fetchDocumentRequests();
      setRequests(freshRequests);
      setMessage('Request reopened. It is ready for release; collection must be recorded again.');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reopen the request. Refresh before trying again.');
      return false;
    } finally { setIsWorking(false); }
  }

  if (!hasLoaded) return <AdminPageSkeleton href="/admin/documents" />;

  return (
    <section className="admin-page reports-page documents-page">

      <div className="resident-panel document-requests-panel" aria-busy={isLoading}>
        <div className="resident-panel-heading">
          <div>
            <h2>Submitted requests</h2>
            <p>{requests.length} {requests.length === 1 ? "request" : "requests"}</p>
          </div>
        </div>
      <div className="certificate-queue-tools">
        <label className="resident-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search certificate requests"
            placeholder="Search name, certificate, or ID…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <div className="certificate-status-filter">
          <span>Status</span>
          <UiDropdown
            ariaLabel="Filter certificate requests by status"
            value={selectedFilter}
            options={filters.map(filter => ({ ...filter }))}
            onChange={value => setSelectedFilter(value as FilterValue)}
          />
        </div>
        {searchQuery.trim() || selectedFilter !== "all" ? (
          <button type="button" className="secondary-admin-button" onClick={() => { setSearchQuery(""); setSelectedFilter("all"); }}>Reset filters</button>
        ) : null}
        <RefreshButton loading={isLoading} onClick={loadRequests} />
      </div>
      <div className="certificate-filter-summary" role="status">
        {searchQuery.trim() || selectedFilter !== "all" ? `${filteredRequests.length} matching ${filteredRequests.length === 1 ? "request" : "requests"}` : ""}
      </div>

      {message && !selectedRequest ? (
        <div className="admin-message" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

        <div className="document-request-list">
          {requests.length === 0 && !isLoading ? (
            <div className="empty-state">No certificate requests yet.</div>
          ) : filteredRequests.length === 0 && !isLoading ? (
            <div className="empty-state">
              No certificate requests match these filters.
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
          onClose={() => { if (!isWorking) setSelectedId(null); }}
          onStatusChange={handleStatusChange}
          onReopen={handleReopen}
        />
      ) : null}
    </section>
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
