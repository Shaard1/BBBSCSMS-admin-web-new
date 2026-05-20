"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useAdminRole } from "@/components/admin-role-context";
import {
  createStaffAccount,
  fetchOfficeAccounts,
  updateOfficeRole,
  type OfficeAccount
} from "@/lib/office-accounts";
import { canManageOfficeAccounts } from "@/lib/roles";

export default function StaffAccountsPage() {
  const { role } = useAdminRole();
  const canManage = canManageOfficeAccounts(role);
  const [accounts, setAccounts] = useState<OfficeAccount[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
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

  return (
    <section className="admin-page residents-page">
      <div className="page-heading">
        <p>Office accounts</p>
        <h2>Staff Account Management</h2>
        <span>Create staff accounts and maintain admin/staff access assignments.</span>
      </div>

      <div className="report-stats">
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
        <section className="announcement-panel">
          <div className="announcement-section-header">
            <span><UserPlus size={20} /></span>
            <div>
              <h3>Create Staff Account</h3>
              <p>Provision a new office account with staff access.</p>
            </div>
            <em>Admin only</em>
          </div>
          <form className="announcement-form" onSubmit={handleSubmit}>
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

      <div className="resident-panel" style={{ marginTop: 20 }}>
        <div className="resident-panel-heading">
          <h3>Office User Directory</h3>
          <button onClick={loadAccounts} type="button">Refresh</button>
        </div>
        <div className="resident-table">
          <div className="resident-table-head">
            <span>Account</span>
            <span>Role</span>
            <span>Actions</span>
          </div>

          {isLoading ? (
            <div className="empty-state">Loading office accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">No admin/staff profiles found.</div>
          ) : (
            accounts.map((account) => (
              <article className="resident-row" key={account.id}>
                <div className="resident-person">
                  <span className="resident-avatar fallback">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <strong>{account.full_name || "Unnamed office user"}</strong>
                    <span>{account.id}</span>
                  </div>
                </div>
                <span className={`status-badge ${account.role === "admin" ? "approved" : "pending"}`}>
                  {account.role === "admin" ? "Admin" : "Staff"}
                </span>
                <div className="row-actions">
                  <select
                    aria-label={`Change role for ${account.full_name || account.id}`}
                    disabled={!canManage || isWorking}
                    value={account.role}
                    onChange={(event) => handleRoleChange(account, event.target.value as "admin" | "staff")}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
