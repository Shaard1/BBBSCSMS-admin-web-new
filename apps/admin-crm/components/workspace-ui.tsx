import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";

export function PageHeader({
  title,
  description,
  eyebrow = "Barangay Bancao-Bancao",
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="workspace-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? (
        <div className="workspace-heading-actions">{children}</div>
      ) : null}
    </div>
  );
}
export function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="secondary-admin-button"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  );
}
export function Metric({
  label,
  value,
  note,
  href,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  note: string;
  href?: string;
  tone?: string;
}) {
  const content = (
    <>
      <div className="metric-label">
        {label}
        {href ? <ArrowUpRight size={17} aria-hidden="true" /> : null}
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </>
  );
  return href ? (
    <Link className={`workspace-metric ${tone}`} href={href}>
      {content}
    </Link>
  ) : (
    <article className={`workspace-metric ${tone}`}>{content}</article>
  );
}
export function Notice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return message ? (
    <div className="admin-message" role="status">
      <span>{message}</span>
      {onDismiss ? (
        <button onClick={onDismiss} type="button">
          Dismiss
        </button>
      ) : null}
    </div>
  ) : null;
}
export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
