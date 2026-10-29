"use client";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileBadge2,
  FileText,
  MapPinned,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  PageActions,
  Panel,
  Notice,
  RefreshButton,
} from "@/components/workspace-ui";
import { fetchAnnouncements } from "@/lib/announcements";
import { fetchDocumentRequests } from "@/lib/document-requests";
import { fetchReports } from "@/lib/reports";
import { fetchResidentMetrics } from "@/lib/residents";
import {
  normalizeReportStatus,
  reportStatusLabel,
  shortReportCategory,
} from "@/lib/report-utils";
import { reportSnapshot } from "@/lib/workspace-metrics";
import type {
  Announcement,
  CommunityReport,
  DocumentRequest,
  Resident,
} from "@/lib/types";

export default function AdminDashboardPage() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [legacyPendingTotal,setLegacyPendingTotal]=useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  async function load() {
    setIsLoading(true);
    setMessage("");
    try {
      const [r, u, a, d] = await Promise.all([
        fetchReports({ images: false }),
        fetchResidentMetrics(),
        fetchAnnouncements(),
        fetchDocumentRequests({ images: false }),
      ]);
      setReports(r);
      setResidents(u.legacyQueue);
      setLegacyPendingTotal(u.summary.legacyPending);
      setAnnouncements(a);
      setDocuments(d);
      setHasLoaded(true);
      setLastUpdated(
        new Date().toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh the dashboard. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const snapshot = useMemo(() => reportSnapshot(reports), [reports]);
  const pendingResidents = residents.filter((r) => r.status === "pending");
  const pendingDocuments = documents.filter((d) => d.status === "pending");
  const readyDocuments = documents.filter(
    (d) => d.status === "ready_for_release",
  ).length;
  const draftCount = announcements.filter((a) => !a.is_published).length;
  const recentReports = [...reports]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);
  const queues = [
    {
      title: "Review previous registrations",
      detail: "Only accounts using the old registration process",
      count: legacyPendingTotal,
      href: "/admin/residents",
      icon: ShieldCheck,
    },
    {
      title: "Review community reports",
      detail: "Categorize concerns and start follow-up",
      count: snapshot.pending,
      href: "/admin/reports",
      icon: FileText,
    },
    {
      title: "Process certificate requests",
      detail: "Review applications, fees, and requirements",
      count: pendingDocuments.length,
      href: "/admin/documents",
      icon: FileBadge2,
    },
  ].filter((queue) => queue.href !== "/admin/residents" || queue.count > 0);
  if (isLoading && !hasLoaded) return <AdminPageSkeleton href="/admin/dashboard" />;

  return (
    <section className="workspace-page overview-page" aria-busy={isLoading}>
      <PageActions>
        <span className="sync-note">
          {lastUpdated ? `Updated ${lastUpdated}` : "Not yet refreshed"}
        </span>
        <RefreshButton loading={isLoading} onClick={load} />
      </PageActions>
      <Notice message={message} onDismiss={() => setMessage("")} />
      <section className="dashboard-summary" aria-label="Workload summary">
        <div className="dashboard-summary-grid">
          {[
            { label: "Open reports", value: snapshot.open, href: "/admin/reports" },
            { label: "Ready for collection", value: readyDocuments, href: "/admin/documents" },
            { label: "Requests awaiting review", value: pendingDocuments.length, href: "/admin/documents" },
            { label: "Resolved reports", value: snapshot.resolved, href: "/admin/reports" },
          ].map((metric) => (
            <Link className="dashboard-summary-item" href={metric.href} key={metric.label}>
              <span className="dashboard-summary-label">
                {metric.label}<ArrowUpRight size={17} aria-hidden="true" />
              </span>
              <strong>{metric.value}</strong>
            </Link>
          ))}
        </div>
      </section>
      <div className="overview-columns">
        <Panel
          title="Needs your attention"
          description="Start with the queues waiting for review."
        >
          <div className="action-queue">
            {queues.map((q) => (
              <Link href={q.href} key={q.href}>
                <span className="queue-icon">
                  <q.icon size={21} />
                </span>
                <div>
                  <h3>{q.title}</h3>
                  <p>{q.detail}</p>
                </div>
                <strong>{q.count}</strong>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
          <div className="queue-footnote">
            <span>
              {snapshot.overdue} open reports are at least 7 days old.
            </span>
            <Link href="/admin/reports">
              Review reports <ArrowRight size={14} />
            </Link>
          </div>
        </Panel>
        <Panel
          title="Field & communications"
          description="Keep local action and public updates connected."
        >
          <div className="operation-link">
            <MapPinned size={22} />
            <div>
              <h3>Complaint map</h3>
              <p>
                {snapshot.mapped} mapped reports · {snapshot.unmappedOpen} open
                reports without valid locations
              </p>
              <Link href="/admin/map">
                Explore the map <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className="operation-link">
            <Megaphone size={22} />
            <div>
              <h3>Public announcements</h3>
              <p>
                {announcements.length - draftCount} published · {draftCount}{" "}
                drafts
              </p>
              <Link href="/admin/announcements">
                Manage announcements <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Panel>
      </div>
      <div className="overview-columns">
        <Panel
          title="Recent community reports"
          description="Latest submissions across all statuses."
          action={<Link href="/admin/reports">View all</Link>}
        >
          <div className="overview-list">
            {recentReports.length ? (
              recentReports.map((r) => (
                <Link href="/admin/reports" key={r.id}>
                  <span className="list-avatar">
                    <FileText size={18} />
                  </span>
                  <div>
                    <strong>{shortReportCategory(r.category)}</strong>
                    <p>{r.description || "No description provided"}</p>
                    <small>
                      {r.reporter_name || "Resident"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </div>
                  <span
                    className={`status-badge ${normalizeReportStatus(r.status).replace(" ", "-")}`}
                  >
                    {reportStatusLabel(normalizeReportStatus(r.status))}
                  </span>
                </Link>
              ))
            ) : (
              <p className="empty-state">No community reports yet.</p>
            )}
          </div>
        </Panel>
        {legacyPendingTotal > 0 ? <Panel
          title="Previous registration queue"
          description="Accounts submitted under the previous registration process."
          action={<Link href="/admin/residents">View all</Link>}
        >
          <div className="overview-list">
            {[...pendingResidents]
              .sort(
                (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
              )
              .slice(0, 5)
              .map((r) => (
                <Link href="/admin/residents" key={r.id}>
                  <span className="list-avatar">
                    {r.full_name?.charAt(0) || "R"}
                  </span>
                  <div>
                    <strong>{r.full_name || "Unnamed resident"}</strong>
                    <p>{r.address || "Address not provided"}</p>
                    <small>
                      {new Date(r.created_at).toLocaleDateString("en-PH")}
                    </small>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            {!legacyPendingTotal ? (
              <p className="empty-state">
                No registrations waiting for review.
              </p>
            ) : null}
          </div>
        </Panel> : null}
      </div>
    </section>
  );
}
