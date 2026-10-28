"use client";

import { usePathname } from "next/navigation";

const pages: Record<string, { title: string; description: string }> = {
  dashboard: { title: "Community overview", description: "A clear view of today's workload and the people waiting for your help." },
  analytics: { title: "Service analytics", description: "Understand demand, track follow-through, and plan community services." },
  staff: { title: "Staff accounts", description: "Manage office accounts and access." },
  reports: { title: "Community reports", description: "Triage resident concerns, record follow-up notes, and track each case to resolution." },
  documents: { title: "Document requests", description: "Review applications and prepare documents for office collection." },
  map: { title: "Complaint map", description: "Locate reported concerns and connect field work with resident reports." },
  residents: { title: "Resident accounts", description: "Manage resident access and view account information." },
  announcements: { title: "Announcements", description: "Keep residents informed with clear, timely barangay updates." },
};

export function AdminPageSkeleton({ href }: { href?: string }) {
  const pathname = usePathname();
  const route = (href ?? pathname).split("/")[2];
  const page = pages[route] ?? { title: "Workspace", description: "Loading page content." };
  return (
    <section className="workspace-page page-skeleton" aria-busy="true" aria-label={page.title}>
      <p className="page-skeleton-status" role="status">Loading {page.title.toLowerCase()}…</p>
      <div aria-hidden="true">
        <div className="page-skeleton-metrics">
          {[0, 1, 2, 3].map(index => <div className="page-skeleton-card" key={index}><span className="skeleton-line skeleton-short" /><span className="skeleton-line skeleton-value" /></div>)}
        </div>
        <div className="page-skeleton-panel">
          <span className="skeleton-line skeleton-short" />
          {route === "map" ? <div className="page-skeleton-map" /> : [0, 1, 2, 3, 4].map(index => <div className="page-skeleton-row" key={index}><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line skeleton-short" /></div>)}
        </div>
      </div>
    </section>
  );
}
