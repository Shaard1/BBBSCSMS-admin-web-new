"use client";
import Link from "next/link";
import {
  ArrowRight,
  FileBadge2,
  FileText,
  MapPinned,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  Metric,
  Panel,
  Notice,
  RefreshButton,
} from "@/components/workspace-ui";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
import { fetchAnnouncements } from "@/lib/announcements";
import { fetchDocumentRequests } from "@/lib/document-requests";
import { fetchReports } from "@/lib/reports";
import { fetchResidents } from "@/lib/residents";
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  async function load() {
    setIsLoading(true);
    setMessage("");
    try {
      const [r, u, a, d] = await Promise.all([
        fetchReports(),
        fetchResidents(),
        fetchAnnouncements(),
        fetchDocumentRequests(),
      ]);
      setReports(r);
      setResidents(u);
      setAnnouncements(a);
      setDocuments(d);
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
      title: "Verify residents",
      detail: "Check identity documents and registration details",
      count: pendingResidents.length,
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
      title: "Process document requests",
      detail: "Review applications, fees, and requirements",
      count: pendingDocuments.length,
      href: "/admin/documents",
      icon: FileBadge2,
    },
  ];
  return (
    <section className="workspace-page overview-page" aria-busy={isLoading}>
      <PageHeader
        title="Community overview"
        description="A clear view of today's workload and the people waiting for your help."
      >
        <span className="sync-note">
          {lastUpdated ? `Updated ${lastUpdated}` : "Not yet refreshed"}
        </span>
        <RefreshButton loading={isLoading} onClick={load} />
      </PageHeader>
      <Notice message={message} onDismiss={() => setMessage("")} />
      {isLoading ? (
        <AdminLoadingOverlay label="Loading community overview…" />
      ) : null}
      <div className="workspace-metrics">
        <Metric
          label="Open reports"
          value={snapshot.open}
          note={`${snapshot.progress} currently in progress`}
          href="/admin/reports"
        />
        <Metric
          label="Awaiting verification"
          value={pendingResidents.length}
          note="Resident registrations to review"
          href="/admin/residents"
          tone="amber"
        />
        <Metric
          label="Document review"
          value={pendingDocuments.length}
          note={`${readyDocuments} ready for release`}
          href="/admin/documents"
          tone="teal"
        />
        <Metric
          label="Resolved reports"
          value={snapshot.resolved}
          note={`${snapshot.resolutionRate}% of all submitted reports`}
          href="/admin/reports"
          tone="green"
        />
      </div>
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
        <Panel
          title="Resident review queue"
          description="Oldest pending registrations first."
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
            {!pendingResidents.length ? (
              <p className="empty-state">
                No registrations waiting for review.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </section>
  );
}
