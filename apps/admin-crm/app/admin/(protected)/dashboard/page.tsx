"use client";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";
import Link from "next/link";
import { ReportCategoryIcon } from "@/components/report-category-icon";
import {
  ArrowRight,
  ArrowUpRight,
  FileBadge2,
  FileText,
  MapPinned,
  Megaphone,
  ShieldCheck,
} from "@/components/crm-icons";
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
  normalizeReportCategory,
  normalizeReportStatus,
  reportStatusLabel,
  shortReportCategory,
} from "@/lib/report-utils";
import { reportSnapshot } from "@/lib/workspace-metrics";
import type {
  Announcement,
  CommunityReport,
  DocumentRequest,
} from "@/lib/types";

export default function AdminDashboardPage() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
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
      title: "Previous registrations",
      count: legacyPendingTotal,
      href: "/admin/residents",
      icon: ShieldCheck,
    },
    {
      title: "Pending reports",
      count: snapshot.pending,
      href: "/admin/reports",
      icon: FileText,
    },
    {
      title: "Certificate requests",
      count: pendingDocuments.length,
      href: "/admin/documents",
      icon: FileBadge2,
    },
  ].filter((queue) => queue.href !== "/admin/residents" || queue.count > 0);
  if (isLoading && !hasLoaded) return <AdminPageSkeleton href="/admin/dashboard" />;

  return (
    <section className="workspace-page overview-page dashboard-page" aria-busy={isLoading}>
      <PageActions><RefreshButton loading={isLoading} onClick={load}/></PageActions>
      <Notice message={message} onDismiss={()=>setMessage("")}/>
      <section className="dashboard-summary" aria-label="Workload summary">
        <div className="dashboard-summary-grid">{[
          {label:"Open reports",value:snapshot.open,detail:snapshot.open?snapshot.pending+" pending · "+snapshot.progress+" in progress":"No open reports",href:"/admin/reports"},
          {label:"Pending certificates",value:pendingDocuments.length,detail:pendingDocuments.length?"Awaiting review":"No requests awaiting review",href:"/admin/documents"},
          {label:"Ready for collection",value:readyDocuments,detail:readyDocuments?"Awaiting pickup":"Nothing ready for pickup",href:"/admin/documents"},
          {label:"Resolved reports",value:snapshot.resolved,detail:reports.length?snapshot.resolutionRate+"% of all reports":"No reports yet",href:"/admin/reports"},
        ].map(metric=><Link className="dashboard-summary-item" href={metric.href} key={metric.label}>
          <span className="dashboard-summary-label">{metric.label}<ArrowUpRight size={17} aria-hidden="true"/></span>
          <strong>{metric.value}</strong><span className="dashboard-summary-detail">{metric.detail}</span>
        </Link>)}</div>
      </section>
      <div className="dashboard-content">
        <div className="dashboard-recent"><Panel title="Recent reports" action={<Link href="/admin/reports">View all <ArrowUpRight size={14}/></Link>}>
          <div className="overview-list">{recentReports.length?recentReports.map(r=><Link href="/admin/reports" key={r.id}>
            <span className="list-avatar" data-category={normalizeReportCategory(r.category)}><ReportCategoryIcon category={r.category} size={20}/></span>
            <div><strong>{shortReportCategory(r.category)}</strong><p>{r.description||"No description provided"}</p>
            <small>{r.reporter_name||"Resident"}</small></div>
            <div className="dashboard-report-meta"><span className={"status-badge "+normalizeReportStatus(r.status).replace(" ","-")}>{reportStatusLabel(normalizeReportStatus(r.status))}</span><time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</time></div>
          </Link>):<p className="empty-state">No reports yet.</p>}</div>
        </Panel></div>
        <div className="dashboard-attention"><Panel title="Awaiting review">
          <div className="action-queue">{queues.map(q=><Link href={q.href} key={q.href}>
            <span className="queue-icon"><q.icon size={20}/></span><div><h3>{q.title}</h3></div><strong>{q.count}</strong><ArrowRight size={16}/>
          </Link>)}</div>
          {snapshot.overdue>0?<Link className="dashboard-overdue" href="/admin/reports"><span><strong>{snapshot.overdue}</strong> reports open 7+ days</span><ArrowUpRight size={16}/></Link>:null}
        </Panel></div>
        <div className="dashboard-shortcuts"><Panel title="Workspace">
          <Link className="dashboard-shortcut" href="/admin/map"><span className="queue-icon"><MapPinned size={20}/></span><div><h3>Complaint map</h3><p>{snapshot.mapped} mapped{snapshot.unmappedOpen>0?" · "+snapshot.unmappedOpen+" missing locations":""}</p></div><ArrowUpRight size={17}/></Link>
          <Link className="dashboard-shortcut" href="/admin/announcements"><span className="queue-icon"><Megaphone size={20}/></span><div><h3>Announcements</h3><p>{announcements.length-draftCount} published · {draftCount} drafts</p></div><ArrowUpRight size={17}/></Link>
        </Panel></div>
      </div>
      {lastUpdated?<p className="dashboard-updated">Updated {lastUpdated}</p>:null}
    </section>
  );
}
