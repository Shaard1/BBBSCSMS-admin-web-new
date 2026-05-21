/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Check,
  Eye,
  Search,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  approveResident,
  fetchResidents,
  rejectResident
} from "@/lib/residents";
import { ImageViewer } from "@/components/image-viewer";
import { useAdminRole } from "@/components/admin-role-context";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { canApproveResidents } from "@/lib/roles";
import type { Resident } from "@/lib/types";

const filters = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Flagged", value: "flagged" }
];

const rejectionOptions = [
  "Invalid ID",
  "Blurry ID photo",
  "Incomplete information",
  "Address cannot be verified",
  "Not a barangay resident"
];

type FilterValue = "all" | "pending" | "approved" | "flagged";

export default function ResidentsPage() {
  const { role } = useAdminRole();
  const canManageApprovals = canApproveResidents(role);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [viewingImage, setViewingImage] = useState<{ title: string; url: string } | null>(null);
  const [approvingResident, setApprovingResident] = useState<Resident | null>(null);
  const [rejectingResident, setRejectingResident] = useState<Resident | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  async function loadResidents() {
    setIsLoading(true);
    try {
      const data = await fetchResidents();
      setResidents(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load residents.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadResidents();
  }, []);

  const filteredResidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return residents
      .filter((resident) => {
        if (selectedFilter === "all") return true;
        return normalizeStatus(resident) === selectedFilter;
      })
      .filter((resident) => {
        if (!query) return true;

        return [
          resident.full_name,
          resident.id,
          resident.address,
          resident.contact_number,
          resident.id_type
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [residents, searchQuery, selectedFilter]);

  async function handleApprove(resident: Resident) {
    setIsWorking(true);
    try {
      const result = await approveResident(resident.id);
      await loadResidents();
      setMessage(
        result.profileSynced
          ? `${resident.full_name} was approved.`
          : `${resident.full_name} was approved. ${result.warning}`
      );
      setApprovingResident(null);
      setSelectedResident(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleReject() {
    if (!rejectingResident) return;

    const reason = rejectionReason === "Other" ? customReason.trim() : rejectionReason;
    if (!reason) return;

    setIsWorking(true);
    try {
      await rejectResident(rejectingResident.id, reason);
      await loadResidents();
      setMessage(`${rejectingResident.full_name} was rejected.`);
      setRejectingResident(null);
      setSelectedResident(null);
      setRejectionReason("");
      setCustomReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rejection failed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="admin-page residents-page">
      <div className="page-heading">
        <p>Resident records</p>
        <h2>Resident Verification</h2>
        <span>
          Review and process new community registrations to ensure accurate
          demographic records.
        </span>
      </div>

      <div className="residents-toolbar">
        <div className="filter-tabs">
          {filters.map((filter) => (
            <button
              className={selectedFilter === filter.value ? "active" : ""}
              key={filter.value}
              onClick={() => setSelectedFilter(filter.value as FilterValue)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="resident-search">
          <Search size={17} />
          <input
            placeholder="Search residents, ID, address..."
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

      <div className="resident-panel">
        <div className="resident-panel-heading">
          <h3>Recent Submissions</h3>
          <button onClick={loadResidents} type="button">Refresh</button>
        </div>
        <div className="resident-table">
          <div className="resident-table-head">
            <span>Resident Applicant</span>
            <span>Date Submitted</span>
            <span>Doc Status</span>
            <span>Actions</span>
          </div>

          {filteredResidents.length === 0 && !isLoading ? (
            <div className="empty-state">No resident submissions match this view.</div>
          ) : (
            filteredResidents.map((resident) => (
              <ResidentRow
                key={resident.id}
                resident={resident}
                onApprove={setApprovingResident}
                canManageApprovals={canManageApprovals}
                onReject={setRejectingResident}
                onView={setSelectedResident}
              />
            ))
          )}
        </div>
      </div>
      {isLoading ? <AdminLoadingOverlay label="Loading resident submissions..." /> : null}

      {selectedResident ? (
        <ResidentDetailsDialog
          resident={selectedResident}
          canManageApprovals={canManageApprovals}
          isWorking={isWorking}
          onApprove={setApprovingResident}
          onClose={() => setSelectedResident(null)}
          onImageView={setViewingImage}
          onReject={setRejectingResident}
        />
      ) : null}

      {approvingResident ? (
        <ApproveDialog
          isWorking={isWorking}
          resident={approvingResident}
          onClose={() => setApprovingResident(null)}
          onSubmit={() => handleApprove(approvingResident)}
        />
      ) : null}

      {rejectingResident ? (
        <RejectDialog
          customReason={customReason}
          isWorking={isWorking}
          reason={rejectionReason}
          resident={rejectingResident}
          onClose={() => {
            setRejectingResident(null);
            setRejectionReason("");
            setCustomReason("");
          }}
          onCustomReasonChange={setCustomReason}
          onReasonChange={setRejectionReason}
          onSubmit={handleReject}
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

function ApproveDialog({
  isWorking,
  resident,
  onClose,
  onSubmit
}: {
  isWorking: boolean;
  resident: Resident;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="approve-modal">
        <div className="modal-header">
          <span className="approval-icon">
            <Check size={22} />
          </span>
          <div>
            <h2>Approve Resident?</h2>
            <p>
              {displayValue(resident.full_name)} will be marked as approved and can access the resident dashboard.
            </p>
          </div>
          <button onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="approval-summary">
          <DetailItem label="Applicant" value={resident.full_name} />
          <DetailItem label="ID type" value={resident.id_type} />
        </div>
        <div className="modal-actions">
          <button className="secondary-admin-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-admin-button" disabled={isWorking} onClick={onSubmit} type="button">
            {isWorking ? "Approving..." : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResidentRow({
  canManageApprovals,
  resident,
  onApprove,
  onReject,
  onView
}: {
  canManageApprovals: boolean;
  resident: Resident;
  onApprove: (resident: Resident) => void;
  onReject: (resident: Resident) => void;
  onView: (resident: Resident) => void;
}) {
  const status = normalizeStatus(resident);
  const showActions = canManageApprovals && status === "pending";

  return (
    <article className="resident-row" onClick={() => onView(resident)}>
      <div className="resident-person">
        <ResidentAvatar resident={resident} />
        <div>
          <strong>{displayValue(resident.full_name)}</strong>
          <span>ID: REG-{resident.id.slice(0, 8)}</span>
        </div>
      </div>
      <time>{formatSubmittedAt(resident.created_at)}</time>
      <StatusBadge status={status} />
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        <button aria-label="View resident" onClick={() => onView(resident)} type="button">
          <Eye size={18} />
        </button>
        {showActions ? (
          <>
            <button aria-label="Approve resident" onClick={() => onApprove(resident)} type="button">
              <Check size={18} />
            </button>
            <button aria-label="Reject resident" onClick={() => onReject(resident)} type="button">
              <X size={18} />
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function ResidentDetailsDialog({
  canManageApprovals,
  resident,
  isWorking,
  onApprove,
  onClose,
  onImageView,
  onReject
}: {
  canManageApprovals: boolean;
  resident: Resident;
  isWorking: boolean;
  onApprove: (resident: Resident) => void;
  onClose: () => void;
  onImageView: (image: { title: string; url: string }) => void;
  onReject: (resident: Resident) => void;
}) {
  const status = normalizeStatus(resident);
  const showActions = canManageApprovals && status === "pending";
  const profileImage = resident.profile_image_original || resident.profile_image || "";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="resident-modal">
        <div className="modal-header">
          <div>
            <h2>{displayValue(resident.full_name)}</h2>
            <p>{showActions ? "Review resident registration details before approval." : "View resident registration details."}</p>
          </div>
          <StatusBadge status={status} />
          <button onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="detail-grid">
          <DetailItem label="Birthdate" value={formatDate(resident.birthdate)} />
          <DetailItem label="Gender" value={resident.gender} />
          <DetailItem label="Civil status" value={resident.civil_status} />
          <DetailItem label="Address" value={resident.address} />
          <DetailItem label="Contact number" value={resident.contact_number} />
          <DetailItem label="ID type" value={resident.id_type} />
          <DetailItem label="Rejection reason" value={resident.rejection_reason} />
        </div>

        <div className="image-review-grid">
          <ImagePreview title="Profile image" imageUrl={profileImage} onView={onImageView} />
          <ImagePreview title="ID image (Front)" imageUrl={resident.id_image_front || resident.id_image || ""} onView={onImageView} />
          <ImagePreview title="ID image (Back)" imageUrl={resident.id_image_back || ""} onView={onImageView} />
        </div>

        <div className="modal-actions">
          <button className="secondary-admin-button" onClick={onClose} type="button">
            Close
          </button>
          {showActions ? (
            <>
              <button className="danger-admin-button" disabled={isWorking} onClick={() => onReject(resident)} type="button">
                Reject
              </button>
              <button className="primary-admin-button" disabled={isWorking} onClick={() => onApprove(resident)} type="button">
                Approve
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RejectDialog({
  customReason,
  isWorking,
  reason,
  resident,
  onClose,
  onCustomReasonChange,
  onReasonChange,
  onSubmit
}: {
  customReason: string;
  isWorking: boolean;
  reason: string;
  resident: Resident;
  onClose: () => void;
  onCustomReasonChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const isCustom = reason === "Other";
  const canSubmit = isCustom ? customReason.trim().length > 0 : reason.length > 0;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="reject-modal">
        <div className="modal-header">
          <div>
            <h2>Reject {displayValue(resident.full_name)}?</h2>
            <p>Select a reason for rejection.</p>
          </div>
          <button onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="reason-options">
          {[...rejectionOptions, "Other"].map((option) => (
            <button
              className={reason === option ? "active" : ""}
              key={option}
              onClick={() => onReasonChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <textarea
          disabled={!isCustom}
          placeholder="Explain why this registration was rejected"
          value={customReason}
          onChange={(event) => onCustomReasonChange(event.target.value)}
        />
        <div className="modal-actions">
          <button className="secondary-admin-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="danger-admin-button"
            disabled={!canSubmit || isWorking}
            onClick={onSubmit}
            type="button"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function ImagePreview({
  title,
  imageUrl,
  onView
}: {
  title: string;
  imageUrl: string;
  onView: (image: { title: string; url: string }) => void;
}) {
  const url = imageUrl.trim();

  return (
    <div className="image-preview">
      <strong>{title}</strong>
      {url ? (
        <button onClick={() => onView({ title, url })} type="button">
          <img src={url} alt={title} />
        </button>
      ) : (
        <div>No image uploaded</div>
      )}
    </div>
  );
}

function ResidentAvatar({ resident }: { resident: Resident }) {
  const image = resident.profile_image?.trim();

  if (image) {
    return <img className="resident-avatar" src={image} alt="" />;
  }

  return (
    <span className="resident-avatar fallback">
      <UserRound size={19} />
    </span>
  );
}

function StatusBadge({ status }: { status: ReturnType<typeof normalizeStatus> }) {
  const label = status === "flagged" ? "Flagged" : status === "approved" ? "Approved" : "Pending";

  return <span className={`status-badge ${status}`}>{label}</span>;
}

function normalizeStatus(resident: Resident) {
  const status = resident.status?.toLowerCase().trim();
  if (status === "approved") return "approved";
  if (status === "rejected") return "flagged";
  return "pending";
}

function displayValue(value?: string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : "Not provided";
}

function formatDate(value?: string) {
  if (!value?.trim()) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function formatSubmittedAt(value?: string) {
  if (!value?.trim()) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  });
}
