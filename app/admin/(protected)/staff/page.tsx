"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { useAdminRole } from "@/components/admin-role-context";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { UiDropdown } from "@/components/ui-dropdown";
import {
  createStaffAccount,
  deleteOfficeAccount,
  fetchOfficeAccounts,
  updateOfficeRole,
  type OfficeAccount
} from "@/lib/office-accounts";
import { canManageOfficeAccounts } from "@/lib/roles";

const roleOptions = [
  { label: "Staff", value: "staff" },
  { label: "Admin", value: "admin" }
];

function getAccountStatusLabel(status?: string) {
  const normalizedStatus = status?.toLowerCase().trim();

  if (normalizedStatus === "approved") return "Approved";
  if (normalizedStatus === "rejected") return "Rejected";
  if (normalizedStatus === "pending") return "Pending";

  return "Approved";
}

function getAccountStatusClassName(status?: string) {
  const normalizedStatus = status?.toLowerCase().trim();

  if (normalizedStatus === "rejected") return "flagged";
  if (normalizedStatus === "pending") return "pending";

  return "approved";
}

export default function StaffAccountsPage() {
  const { role } = useAdminRole();
  const canManage = canManageOfficeAccounts(role);
  const [accounts, setAccounts] = useState<OfficeAccount[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OfficeAccount | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  async function loadAccounts() {
    setIsLoading(true);
    try {
      const data = await fetchOfficeAccounts();
      setAccounts(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load office accounts.");
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
      { admins: 0, staff: 0, total: accounts.length }
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
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create staff account.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRoleChange(account: OfficeAccount, nextRole: "admin" | "staff") {
    if (!canManage || account.role === nextRole) return;
    if (account.role === "admin" && nextRole === "staff" && counts.admins <= 1) {
      setMessage("At least one administrator account must remain assigned.");
      return;
    }

    setIsWorking(true);
    setMessage("");
    try {
      await updateOfficeRole(account.id, nextRole);
      setMessage(`${account.full_name || account.id} role updated to ${nextRole}.`);
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update role.");
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
      setMessage(`${deleteTarget.full_name || deleteTarget.id} account deleted.`);
      setDeleteTarget(null);
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete office account.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="admin-page residents-page staff-page">
      <div className="page-heading">
        <p>Office accounts</p>
        <h2>Staff Account Management</h2>
        <span>Create staff accounts and maintain admin/staff access assignments.</span>
      </div>

      <div className="report-stats staff-stats">
        <article className="report-stat dark">
          <span>Total Office Users</span>
          <strong>{counts.total}</strong>
        </article>
        <article className="report-stat progress">
          <span>Administrators</span>
          <strong>{counts.admins}</strong>
        </article>
        <article className="report-stat resolved">
          <span>Staff</span>
          <strong>{counts.staff}</strong>
        </article>
      </div>

      {message ? (
        <div className="admin-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      {!canManage ? (
        <div className="empty-state">Only administrators can manage office accounts.</div>
      ) : (
        <section className="announcement-panel staff-create-panel">
          <div className="announcement-section-header">
            <span><UserPlus size={20} /></span>
            <div>
              <h3>Create Staff Account</h3>
              <p>Provision a new office account with staff access.</p>
            </div>
            <em>Admin only</em>
          </div>
          <form className="announcement-form staff-form" onSubmit={handleSubmit}>
            <label>
              Full Name
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Enter staff full name"
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
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
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimum 8 characters"
                required
              />
            </label>
            <div className="announcement-form-footer">
              <button className="primary-admin-button" disabled={isWorking} type="submit">
                {isWorking ? "Creating..." : "Create Staff Account"}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="resident-panel staff-directory-panel">
        <div className="resident-panel-heading">
          <div>
            <h3>Office User Directory</h3>
            <p>Review office accounts and update their assigned access level.</p>
          </div>
          <button onClick={loadAccounts} type="button">Refresh</button>
        </div>
        <div className="resident-table staff-directory-table">
          <div className="resident-table-head staff-directory-head">
            <span>Account</span>
            <span>Status</span>
            <span>Role</span>
            <span>Actions</span>
          </div>

          {accounts.length === 0 && !isLoading ? (
            <div className="empty-state">No admin/staff profiles found.</div>
          ) : (
            accounts.map((account) => (
              <article className="resident-row staff-directory-row" key={account.id}>
                <div className="resident-person">
                  <span className="resident-avatar fallback">
                    <ShieldCheck size={19} />
                  </span>
                  <div className="staff-directory-identity">
                    <strong>{account.full_name || "Unnamed office user"}</strong>
                    <span>{account.email?.trim() || "No email saved"}</span>
                    <small>{account.id}</small>
                  </div>
                </div>
                <div className="staff-directory-cell">
                  <span className={`status-badge ${getAccountStatusClassName(account.status)}`}>
                    {getAccountStatusLabel(account.status)}
                  </span>
                </div>
                <div className="staff-directory-cell">
                  <span className={`status-badge ${account.role === "admin" ? "approved" : "info"}`}>
                    {account.role === "admin" ? "Admin" : "Staff"}
                  </span>
                </div>
                <div className="row-actions staff-directory-actions">
                  <UiDropdown
                    ariaLabel={`Change role for ${account.full_name || account.id}`}
                    disabled={!canManage || isWorking}
                    options={roleOptions}
                    value={account.role}
                    onChange={(nextRole) => handleRoleChange(account, nextRole as "admin" | "staff")}
                  />
                  <button
                    className="staff-delete-button"
                    aria-label={`Delete ${account.full_name || "office account"}`}
                    disabled={isWorking}
                    onClick={() => setDeleteTarget(account)}
                    title="Delete account"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
      {isLoading ? <AdminLoadingOverlay label="Loading office accounts..." /> : null}
      {deleteTarget ? (
        <DeleteOfficeAccountDialog
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
  account,
  isWorking,
  onClose,
  onConfirm
}: {
  account: OfficeAccount;
  isWorking: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="reject-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Delete Office Account</h2>
            <p>
              Remove {account.full_name || "this account"} from the office directory and delete its login access?
            </p>
          </div>
          <button onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>
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
          <button className="secondary-admin-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="danger-admin-button" disabled={isWorking} onClick={onConfirm} type="button">
            {isWorking ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
