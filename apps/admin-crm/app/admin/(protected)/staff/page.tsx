"use client";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";

import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/workspace-ui";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Trash2, UserPlus, X } from "@/components/crm-icons";
import { useAdminRole } from "@/components/admin-role-context";
import { UiDropdown } from "@/components/ui-dropdown";
import {
  createStaffAccount,
  deleteOfficeAccount,
  fetchOfficeAccounts,
  updateOfficeRole,
  type OfficeAccount,
} from "@/lib/office-accounts";
import { canManageOfficeAccounts } from "@/lib/roles";

const roleOptions = [
  { label: "Staff", value: "staff" },
  { label: "Admin", value: "admin" },
];

function getAccountStatusLabel(status?: string) {
  const normalizedStatus = status?.toLowerCase().trim();

  if (normalizedStatus === "approved") return "Approved";
  if (normalizedStatus === "rejected") return "Rejected";
  if (normalizedStatus === "pending") return "Pending";

  if (normalizedStatus === "active") return "Active";
  return "Inactive";
}

function getAccountStatusClassName(status?: string) {
  const normalizedStatus = status?.toLowerCase().trim();

  if (normalizedStatus === "rejected") return "flagged";
  if (normalizedStatus === "pending") return "pending";

  return normalizedStatus === "approved" || normalizedStatus === "active"
    ? "approved"
    : "flagged";
}

export default function StaffAccountsPage() {
  const { role } = useAdminRole();
  const canManage = canManageOfficeAccounts(role);
  const [accounts, setAccounts] = useState<OfficeAccount[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const visibleAccounts = accounts.filter((account) =>
    `${account.full_name} ${account.email ?? ""} ${account.role}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const [deleteTarget, setDeleteTarget] = useState<OfficeAccount | null>(null);
  const [roleTarget, setRoleTarget] = useState<{
    account: OfficeAccount;
    nextRole: "admin" | "staff";
  } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  async function loadAccounts() {
    setIsLoading(true);
    try {
      const data = await fetchOfficeAccounts();
      setAccounts(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load office accounts.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  const counts = useMemo(() => {
    return accounts.reduce(
      (summary, account) => {
        if (account.role === "admin") summary.admins += 1;
        if (account.role === "staff") summary.staff += 1;
        return summary;
      },
      { admins: 0, staff: 0, total: accounts.length },
    );
  }, [accounts]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setIsWorking(true);
    setMessage("");
    try {
      await createStaffAccount(form);
      setForm({ fullName: "", email: "", password: "" });
      setMessage("Staff account created.");
      setShowCreate(false);
      await loadAccounts();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to create staff account.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  function handleRoleChange(
    account: OfficeAccount,
    nextRole: "admin" | "staff",
  ) {
    if (!canManage || account.role === nextRole) return;
    if (
      account.role === "admin" &&
      nextRole === "staff" &&
      counts.admins <= 1
    ) {
      setMessage("At least one administrator account must remain assigned.");
      return;
    }

    setMessage("");
    setRoleTarget({ account, nextRole });
  }

  async function handleRoleConfirmed() {
    if (!roleTarget || !canManage) return;
    const { account, nextRole } = roleTarget;

    setIsWorking(true);
    setMessage("");
    try {
      await updateOfficeRole(account.id, nextRole);
      setRoleTarget(null);
      setMessage(
        `${account.full_name || account.id} role updated to ${nextRole}.`,
      );
      await loadAccounts();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to update role.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;

    setIsWorking(true);
    setMessage("");
    try {
      await deleteOfficeAccount(deleteTarget.id);
      setMessage(
        `${deleteTarget.full_name || deleteTarget.id} account deleted.`,
      );
      setDeleteTarget(null);
      await loadAccounts();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete office account.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading && accounts.length === 0) {
    return <AdminPageSkeleton href="/admin/staff" />;
  }

  return (
    <section className="admin-page residents-page staff-page">
      <div className="resident-panel staff-directory-panel" aria-busy={isLoading}>
        <div className="resident-panel-heading">
          <div>
            <h2>Office accounts</h2>
            <p className="staff-account-summary">
              {counts.total} accounts <span aria-hidden="true">·</span> {counts.admins} {counts.admins === 1 ? "administrator" : "administrators"} <span aria-hidden="true">·</span> {counts.staff} staff
            </p>
          </div>
          <div className="staff-toolbar-actions">
            <label className="resident-search">
              <Search size={17} aria-hidden="true" />
              <input aria-label="Search staff accounts" placeholder="Search name, email, or role…" value={query} onChange={(event) => setQuery(event.target.value)} />
              {query ? <button type="button" aria-label="Clear staff search" onClick={() => setQuery("")}><X size={16} /></button> : null}
            </label>
            <RefreshButton loading={isLoading} onClick={loadAccounts} />
            {canManage ? (
              <button
                type="button"
                className="primary-admin-button"
                onClick={() => {
                  setMessage("");
                  setShowCreate(true);
                }}
              >
                <UserPlus size={17} />
                Add staff account
              </button>
            ) : null}
          </div>
        </div>
        <div className="staff-search-summary" role="status">
            {query.trim() ? `${visibleAccounts.length} ${visibleAccounts.length === 1 ? "account" : "accounts"} matching “${query.trim()}”` : ""}
        </div>

        {message && !showCreate && !deleteTarget && !roleTarget ? (
          <div className="admin-message" role="status">
            <span>{message}</span>
            <button onClick={() => setMessage("")} type="button">
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="resident-table staff-directory-table">
          <div className="resident-table-head staff-directory-head">
            <span>Account</span>
            <span>Status</span>
            <span>Role</span>
            <span className="staff-actions-heading">Actions</span>
          </div>

          {visibleAccounts.length === 0 && !isLoading ? (
            <div className="empty-state">
              No office accounts match this search.
            </div>
          ) : (
            visibleAccounts.map((account) => (
              <article
                className="resident-row staff-directory-row"
                key={account.id}
              >
                <div className="resident-person">
                  <span className="resident-avatar fallback">
                    <ShieldCheck size={19} />
                  </span>
                  <div className="staff-directory-identity">
                    <strong>
                      {account.full_name || "Unnamed office user"}
                    </strong>
                    <span>{account.email?.trim() || "No email saved"}</span>
                  </div>
                </div>
                <div className="staff-directory-cell">
                  <span
                    className={`status-badge ${getAccountStatusClassName(account.status)}`}
                  >
                    {getAccountStatusLabel(account.status)}
                  </span>
                </div>
                <div className="staff-directory-cell">
                  <UiDropdown
                    matchTriggerWidth
                    ariaLabel={`Change role for ${account.full_name || account.id}`}
                    disabled={!canManage || isWorking || isLoading}
                    options={roleOptions}
                    value={account.role}
                    onChange={(nextRole) =>
                      handleRoleChange(account, nextRole as "admin" | "staff")
                    }
                  />
                </div>
                <div className="row-actions staff-directory-actions">
                  <button
                    className="staff-delete-button"
                    aria-label={`Delete ${account.full_name || "office account"}`}
                    disabled={!canManage || isWorking || isLoading}
                    onClick={() => {
                      setMessage("");
                      setDeleteTarget(account);
                    }}
                    title="Delete account"
                    type="button"
                  >
                    <Trash2 size={20} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
      {!canManage ? (
        <div className="empty-state">
          Only administrators can manage office accounts.
        </div>
      ) : showCreate ? (
        <Modal
          title="Create staff account"
          className="staff-account-dialog"
          onClose={() => {
            if (!isWorking) setShowCreate(false);
          }}
        >
          <section className="announcement-panel staff-create-panel">
            <div className="modal-header">
              <div>
                <h2>Create staff account</h2>
                <p>Staff can handle daily office services.</p>
              </div>
              <button type="button" aria-label="Close" disabled={isWorking} onClick={() => setShowCreate(false)}><X size={20} /></button>
            </div>
            {message ? (
              <div className="admin-message" role="status">
                {message}
              </div>
            ) : null}
            <form
              className="announcement-form staff-form"
              onSubmit={handleSubmit}
            >
              <label>
                Full Name
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Enter staff full name"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="staff@barangay.gov.ph"
                  required
                />
              </label>
              <label>
                Temporary Password
                <input
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Minimum 8 characters"
                  required
                />
              </label>
              <div className="announcement-form-footer">
                <button
                  className="secondary-admin-button"
                  disabled={isWorking}
                  onClick={() => setShowCreate(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="primary-admin-button"
                  disabled={isWorking}
                  type="submit"
                >
                  {isWorking ? "Creating..." : "Create Staff Account"}
                </button>
              </div>
            </form>
          </section>
        </Modal>
      ) : null}

      <p className="staff-icon-credit">Icons by <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">Flaticon</a></p>
      {roleTarget ? (
        <Modal
          title="Change account role"
          className="staff-account-dialog"
          onClose={() => { if (!isWorking) setRoleTarget(null); }}
        >
          <div className="reject-modal">
            <div className="modal-header">
              <div>
                <h2>Change account role</h2>
                <p>Change {roleTarget.account.full_name || "this account"} to {roleTarget.nextRole === "admin" ? "Administrator" : "Staff"}?</p>
              </div>
              <button type="button" aria-label="Close" disabled={isWorking} onClick={() => setRoleTarget(null)}><X size={20} /></button>
            </div>
            <p className="staff-role-description">
              {roleTarget.nextRole === "admin"
                ? "Administrators can also access analytics, manage office accounts, and delete reports."
                : "Staff can handle daily services. Administrator permissions will be removed."}
            </p>
            {message ? <div className="admin-message" role="alert">{message}</div> : null}
            <div className="modal-actions">
              <button type="button" className="secondary-admin-button" disabled={isWorking} onClick={() => setRoleTarget(null)}>Cancel</button>
              <button type="button" className="primary-admin-button" disabled={isWorking} onClick={handleRoleConfirmed}>{isWorking ? "Saving…" : "Change role"}</button>
            </div>
          </div>
        </Modal>
      ) : null}
      {deleteTarget ? (
        <DeleteOfficeAccountDialog
          message={message}
          account={deleteTarget}
          isWorking={isWorking}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirmed}
        />
      ) : null}
    </section>
  );
}

function DeleteOfficeAccountDialog({
  message,
  account,
  isWorking,
  onClose,
  onConfirm,
}: {
  account: OfficeAccount;
  message: string;
  isWorking: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Delete office account" className="staff-account-dialog" onClose={() => { if (!isWorking) onClose(); }}>
      <div
        className="reject-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Delete Office Account</h2>
            <p>
              Remove {account.full_name || "this account"} from the office
              directory and delete its login access?
            </p>
          </div>
          <button onClick={onClose} disabled={isWorking} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {message ? (
          <div className="admin-message" role="status">
            {message}
          </div>
        ) : null}
        <div className="approval-summary">
          <div className="detail-item">
            <span>Full name</span>
            <strong>{account.full_name || "Unnamed office user"}</strong>
          </div>
          <div className="detail-item">
            <span>Email</span>
            <strong>{account.email?.trim() || "No email saved"}</strong>
          </div>
          <div className="detail-item">
            <span>Role</span>
            <strong>{account.role === "admin" ? "Admin" : "Staff"}</strong>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="secondary-admin-button"
            disabled={isWorking}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="danger-admin-button"
            disabled={isWorking}
            onClick={onConfirm}
            type="button"
          >
            {isWorking ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
