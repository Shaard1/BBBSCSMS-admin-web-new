"use client";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/workspace-ui";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { FileBadge2, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchDocumentRequests,
  summarizeDocumentRequests,
  updateDocumentRequestStatus,
} from "@/lib/document-requests";
import type { DocumentRequest, DocumentRequestStatus } from "@/lib/types";

const filters = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Awaiting Payment", value: "awaiting_payment" },
  { label: "Processing", value: "processing" },
  { label: "Ready for Release", value: "ready_for_release" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
] as const;

const statusOptions: Array<{ label: string; value: DocumentRequestStatus }> = [
  { label: "Mark Pending", value: "pending" },
  { label: "Awaiting Payment", value: "awaiting_payment" },
  { label: "Processing", value: "processing" },
  { label: "Ready for Release", value: "ready_for_release" },
  { label: "Completed", value: "completed" },
  { label: "Reject Request", value: "rejected" },
];

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

  async function loadRequests() {
    setIsLoading(true);

    try {
      const data = await fetchDocumentRequests();
      setRequests(data);
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
  ) {
    if (isWorking || request.status === status) return;
    if (status === "rejected" && !rejectionReason?.trim()) return;

    setIsWorking(true);
    setMessage("");

    try {
      await updateDocumentRequestStatus(
        request.id,
        status,
        request.status,
        rejectionReason,
      );
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
        `${request.certificate_title} request updated to ${statusLabel(status)}.`,
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

      {isLoading ? (
        <AdminLoadingOverlay label="Loading document requests…" />
      ) : null}
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

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="document-detail-item">
      <span>{label}</span>
      <strong>{value?.trim() || "Not provided"}</strong>
    </div>
  );
}

function renderFormData(request: DocumentRequest) {
  if (!request.form_data || typeof request.form_data === "string") {
    return null;
  }

  const entries = Object.entries(request.form_data).filter(([, value]) =>
    typeof value === "string" ? value.trim() : value != null,
  );

  if (entries.length === 0) return null;

  return (
    <div className="document-request-form-data">
      <strong>Submitted Form Details</strong>
      <div className="document-request-grid">
        {entries.map(([key, value]) => (
          <DetailItem
            key={key}
            label={humanizeFieldLabel(key)}
            value={String(value)}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentRequestDialog({
  message,
  isWorking,
  request,
  onClose,
  onStatusChange,
}: {
  isWorking: boolean;
  request: DocumentRequest;
  onClose: () => void;
  message: string;
  onStatusChange: (
    request: DocumentRequest,
    status: DocumentRequestStatus,
    reason?: string,
  ) => void;
}) {
  const [nextStatus, setNextStatus] = useState<DocumentRequestStatus>(
    request.status,
  );
  const [reason, setReason] = useState("");
  return (
    <Modal title="Document request details" onClose={onClose}>
      <div
        className="reject-modal document-request-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{request.certificate_title}</h2>
            <p>{request.resident_name}</p>
          </div>
          <button onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>

        <div className="document-request-current">
          <span>Current status</span>
          <strong className={`status-badge ${statusClassName(request.status)}`}>
            {statusLabel(request.status)}
          </strong>
          <p>Review the submitted details before updating this request.</p>
        </div>
        <div className="document-request-grid">
          <DetailItem label="Resident" value={request.resident_name} />
          <DetailItem label="Contact Number" value={request.contact_number} />
          <DetailItem label="Email" value={request.email} />
          <DetailItem label="Address" value={request.address} />
          <DetailItem
            label="Document Type"
            value={
              request.certificate_variant
                ? `${request.certificate_title} (${request.certificate_variant})`
                : request.certificate_title
            }
          />
          <DetailItem label="Payment Method" value={request.payment_method} />
          <DetailItem
            label="Receiver Name"
            value={request.payment_receiver_name}
          />
          <DetailItem
            label="Receiver Number"
            value={request.payment_receiver_number}
          />
          <DetailItem
            label="Payment Reference"
            value={request.payment_reference}
          />
          <DetailItem label="Fee" value={request.fee_label} />
          <DetailItem label="Purpose" value={request.purpose} />
          <DetailItem
            label="Additional Notes"
            value={request.additional_notes}
          />
          <DetailItem label="Request ID" value={request.id} />
        </div>

        {renderFormData(request)}

        {request.payment_proof_url &&
        /^https?:\/\//i.test(request.payment_proof_url) ? (
          <div className="document-request-proof">
            <strong>Payment Proof</strong>
            <a
              className="secondary-admin-button document-proof-link"
              href={request.payment_proof_url}
              rel="noreferrer"
              target="_blank"
            >
              Open proof image
            </a>
          </div>
        ) : null}

        {request.rejection_reason ? (
          <div className="document-request-reason">
            <strong>Rejection Reason</strong>
            <p>{request.rejection_reason}</p>
          </div>
        ) : null}

        {message ? (
          <div className="admin-message" role="status">
            {message}
          </div>
        ) : null}
        <form
          className="document-request-actions"
          onSubmit={(event) => {
            event.preventDefault();
            onStatusChange(request, nextStatus, reason.trim());
          }}
        >
          <label>
            Update status
            <select
              value={nextStatus}
              disabled={isWorking}
              onChange={(event) =>
                setNextStatus(event.target.value as DocumentRequestStatus)
              }
            >
              {statusOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {statusLabel(option.value)}
                </option>
              ))}
            </select>
          </label>
          {nextStatus === "rejected" ? (
            <label className="rejection-field">
              Reason shown to the resident
              <textarea
                required
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain what needs to be corrected"
              />
            </label>
          ) : null}
          <p className="status-update-help" role="status">
            Current: {statusLabel(request.status)}
            {nextStatus !== request.status
              ? ` → ${statusLabel(nextStatus)}`
              : ". Select a different status to update."}
          </p>
          <button
            className={
              nextStatus === "rejected"
                ? "danger-admin-button"
                : "primary-admin-button"
            }
            type="submit"
            disabled={
              isWorking ||
              nextStatus === request.status ||
              (nextStatus === "rejected" && !reason.trim())
            }
          >
            {isWorking ? "Updating…" : "Update request"}
          </button>
        </form>
      </div>
    </Modal>
  );
}

function humanizeFieldLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
