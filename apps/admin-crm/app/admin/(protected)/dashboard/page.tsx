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
import { createDashboardDemo } from "@/lib/dashboard-demo";
import { reportSnapshot } from "@/lib/workspace-metrics";
import type {
  Announcement,
  CommunityReport,
  DocumentRequest,
} from "@/lib/types";

export default function AdminDashboardPage() {
  const [demo,setDemo]=useState(false);
  const sample=useMemo(()=>createDashboardDemo(),[]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [legacyPendingTotal,setLegacyPendingTotal]=useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [failed,setFailed]=useState({reports:false,residents:false,announcements:false,documents:false});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  async function load() {
    setIsLoading(true);
    setMessage("");
    try {
      const results=await Promise.allSettled([
        fetchReports({images:false}),fetchResidentMetrics(),fetchAnnouncements(),fetchDocumentRequests({images:false}),
      ] as const);
      const [r,u,a,d]=results;
      if(r.status==='fulfilled')setReports(r.value);
      if(u.status==='fulfilled')setLegacyPendingTotal(u.value.summary.legacyPending);
      if(a.status==='fulfilled')setAnnouncements(a.value);
      if(d.status==='fulfilled')setDocuments(d.value);
      setFailed({reports:r.status==='rejected',residents:u.status==='rejected',announcements:a.status==='rejected',documents:d.status==='rejected'});
      const missing=results.flatMap((result,index)=>result.status==='rejected'?['Reports','Resident accounts','Announcements','Certificates'][index]:[]);
      setMessage(missing.length?missing.join(', ')+' unavailable. Use Reset to retry.':'');
      setLastUpdated(new Date().toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}));
    } finally {
      setHasLoaded(true);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);
  const visibleReports=demo?sample.reports:reports;
  const snapshot = useMemo(() => reportSnapshot(visibleReports), [visibleReports]);
  const pendingDocuments = documents.filter((d) => d.status === "pending");
  const pendingCount=demo?sample.pendingCertificates:pendingDocuments.length;
  const readyDocuments = demo?sample.readyCertificates:documents.filter(
    (d) => d.status === "ready_for_release",
  ).length;
  const draftCount = demo?sample.drafts:announcements.filter((a) => !a.is_published).length;
  const publishedCount=demo?sample.published:announcements.length-draftCount;
  const recentReports = [...visibleReports]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);
  const queues = [
    {
      title: "Previous registrations",
      count: !demo&&failed.residents?null:demo?sample.legacyPending:legacyPendingTotal,
      href: "/admin/residents?access=legacy_pending",
      icon: ShieldCheck,
    },
    {
      title: "Pending reports",
      count: !demo&&failed.reports?null:snapshot.pending,
      href: "/admin/reports?status=pending",
      icon: FileText,
    },
    {
      title: "Certificate requests",
      count: !demo&&failed.documents?null:pendingCount,
      href: "/admin/documents?status=pending",
      icon: FileBadge2,
    },
  ].filter((queue) => !queue.href.startsWith("/admin/residents") || queue.count === null || queue.count > 0);
  if (isLoading && !hasLoaded) return <AdminPageSkeleton href="/admin/dashboard" />;

  return (
    <section className="workspace-page overview-page dashboard-page" aria-busy={isLoading}>
      <div className="dashboard-toolbar"><div className="analytics-demo-control"><button type="button" role="switch" aria-label="Demo data" aria-checked={demo} onClick={()=>setDemo(value=>!value)}><span className="analytics-switch-track" aria-hidden="true"><i/></span>Demo data</button></div><PageActions><RefreshButton loading={isLoading} onClick={()=>{setDemo(false);void load();}}/></PageActions></div>
      <Notice message={demo?"":message} onDismiss={()=>setMessage("")}/>
      <section className="dashboard-summary" aria-label="Workload summary">
        <div className="dashboard-summary-grid">{[
          {label:"Open reports",value:!demo&&failed.reports?null:snapshot.open,href:"/admin/reports?status=open"},
          {label:"Pending certificates",value:!demo&&failed.documents?null:pendingCount,href:"/admin/documents?status=pending"},
          {label:"Ready for collection",value:!demo&&failed.documents?null:readyDocuments,href:"/admin/documents?status=ready_for_release"},
          {label:"Resolved reports",value:!demo&&failed.reports?null:snapshot.resolved,href:"/admin/reports?status=resolved"},
        ].map(metric=><Link className="dashboard-summary-item" href={metric.href} key={metric.label}>
          <span className="dashboard-summary-label">{metric.label}<ArrowUpRight size={17} aria-hidden="true"/></span>
          <strong aria-label={metric.value===null?"Unavailable":undefined}>{metric.value===null?"—":metric.value.toLocaleString()}</strong>
        </Link>)}</div>
      </section>
      <div className="dashboard-content">
        <div className="dashboard-attention"><Panel title="Awaiting review">
          <div className="action-queue">{queues.map(q=><Link href={q.href} key={q.href}>
            <span className="queue-icon"><q.icon size={20}/></span><div><h3>{q.title}</h3></div><strong data-count={q.count} aria-label={q.count===null?"Unavailable":undefined}>{q.count===null?"—":q.count}</strong><ArrowRight size={16}/>
          </Link>)}</div>
          {(demo||!failed.reports)&&snapshot.overdue>0?<Link className="dashboard-overdue" href="/admin/reports?status=aged"><span><strong>{snapshot.overdue}</strong> reports open 7+ days</span><ArrowUpRight size={16}/></Link>:null}
        </Panel></div>
        <div className="dashboard-recent"><Panel title="Recent reports" action={<Link href="/admin/reports">View all <ArrowUpRight size={14}/></Link>}>
          <div className="overview-list">{!demo&&failed.reports?<p className="empty-state" role="status">Reports unavailable. Use Reset to retry.</p>:recentReports.length?recentReports.map(r=><Link href={demo?"/admin/reports":"/admin/reports?report="+encodeURIComponent(r.id)} key={r.id}>
            <span className="list-avatar" data-category={normalizeReportCategory(r.category)}><ReportCategoryIcon category={r.category} size={20}/></span>
            <div><strong>{shortReportCategory(r.category)}</strong><p>{r.description||"No description provided"}</p>
            <small>{r.reporter_name||"Resident"}</small></div>
            <div className="dashboard-report-meta"><span className={"status-badge "+normalizeReportStatus(r.status).replace(" ","-")}>{reportStatusLabel(normalizeReportStatus(r.status))}</span><time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</time></div>
          </Link>):<p className="empty-state">No reports yet.</p>}</div>
        </Panel></div>
        <div className="dashboard-shortcuts"><Panel title="Workspace">
          <Link className="dashboard-shortcut" href="/admin/map"><span className="queue-icon"><MapPinned size={20}/></span><div><h3>Complaint map</h3><p>{!demo&&failed.reports?"Report locations unavailable":snapshot.mapped+" mapped"+(snapshot.unmappedOpen>0?" · "+snapshot.unmappedOpen+" missing locations":"")}</p></div><ArrowUpRight size={17}/></Link>
          <Link className="dashboard-shortcut" href="/admin/announcements"><span className="queue-icon"><Megaphone size={20}/></span><div><h3>Announcements</h3><p>{!demo&&failed.announcements?"Announcement counts unavailable":publishedCount+" published · "+draftCount+" drafts"}</p></div><ArrowUpRight size={17}/></Link>
        </Panel></div>
      </div>
      {!demo&&lastUpdated&&!Object.values(failed).some(Boolean)?<p className="dashboard-updated">Updated {lastUpdated}</p>:null}
    </section>
  );
}
