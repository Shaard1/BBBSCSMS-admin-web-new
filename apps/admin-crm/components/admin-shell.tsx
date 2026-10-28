"use client";
import { fetchPendingNotificationIds, notificationReadEvent, unreadIds, type PendingNotificationIds } from "@/lib/notifications";

import {
  BarChart3,
  Bell,
  FileText,
  FileBadge2,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Menu,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AdminRoleProvider } from "@/components/admin-role-context";
import { WorkspaceLoader } from "@/components/workspace-loader";
import { WorkspaceConnectionError } from "@/components/workspace-connection-error";
import { useViewportPopover } from "@/components/use-viewport-popover";
import { clearAdminServerSession, getAdminServerSession } from "@/lib/auth";
import {
  fetchGlobalSearchResults,
  type GlobalSearchResult,
} from "@/lib/global-search";
import {
  canManageOfficeAccounts,
  canViewAnalytics,
  officeRoleLabel,
  type OfficeRole,
} from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type AdminShellProps = {
  children: ReactNode;
};

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    adminOnly: true,
  },
  {
    label: "Staff Accounts",
    href: "/admin/staff",
    icon: UserCog,
    adminOnly: true,
  },
  { label: "Community Reports", href: "/admin/reports", icon: FileText },
  { label: "Document Requests", href: "/admin/documents", icon: FileBadge2 },
  { label: "Complaint Map", href: "/admin/map", icon: MapPinned },
  {
    label: "Resident Accounts",
    href: "/admin/residents",
    icon: UsersRound,
  },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
];

const globalSearchCategories = {
  announcement: "Announcements",
  document: "Document Requests",
  office: "Office Accounts",
  page: "Pages",
  report: "Community Reports",
  resident: "Residents",
} satisfies Record<GlobalSearchResult["category"], string>;

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();
  const [destination, setDestination] = useState<string | null>(null);
  const displayedPath = isNavigating && destination ? destination : pathname;
  const [isChecking, setIsChecking] = useState(true);
  const [accessFailed, setAccessFailed] = useState(false);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [role, setRole] = useState<OfficeRole>("staff");
  const [pendingIds, setPendingIds] = useState<PendingNotificationIds>({ reports: [], documents: [], residents: [] });
  const [officeUserId, setOfficeUserId] = useState("");
  const [readRevision, setReadRevision] = useState(0);
  const unread = useMemo(() => ({
    reports: unreadIds("reports", pendingIds.reports, officeUserId).length,
    documents: unreadIds("documents", pendingIds.documents, officeUserId).length,
    residents: unreadIds("residents", pendingIds.residents, officeUserId).length,
  // The revision changes after a local read or another tab updates read history.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pendingIds, officeUserId, readRevision]);
  const unreadReportsCount = unread.reports;
  const unreadResidentsCount = unread.residents;
  const unreadDocumentsCount = unread.documents;
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);

  useViewportPopover({
    align: "end",
    anchorRef: notificationRef,
    panelRef: notificationPanelRef,
    isOpen: isNotificationOpen,
    setIsOpen: setIsNotificationOpen,
    minWidth: 360,
    maxWidth: 420,
    maxHeight: 480,
  });
  useViewportPopover({
    align: "end",
    anchorRef: searchRef,
    panelRef: searchPanelRef,
    isOpen: isSearchOpen,
    setIsOpen: setIsSearchOpen,
    minWidth: 360,
    maxWidth: 420,
    maxHeight: 480,
  });

  useEffect(() => {
    if (!isSidebarOpen) return;
    const sidebar = document.getElementById("workspace-navigation");
    const previous = document.activeElement as HTMLElement | null;
    const main = document.querySelector<HTMLElement>(".admin-main");
    main?.setAttribute("inert", "");
    const targets = () =>
      Array.from(sidebar?.querySelectorAll<HTMLElement>("a, button") ?? []);
    targets()[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSidebarOpen(false);
      if (event.key !== "Tab") return;
      const elements = targets();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const query = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => {
      if (query.matches) setIsSidebarOpen(false);
    };
    query.addEventListener("change", closeOnDesktop);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keyboard);
    return () => {
      main?.removeAttribute("inert");
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", keyboard);
      query.removeEventListener("change", closeOnDesktop);
      previous?.focus();
    };
  }, [isSidebarOpen]);

  const notificationCount = unreadReportsCount + unreadResidentsCount + unreadDocumentsCount;
  const notificationItems = useMemo(() => {
    return [
      {
        badgeCount: unreadReportsCount,
        count: unreadReportsCount,
        description: "Community reports you have not opened.",
        href: "/admin/reports",
        icon: FileText,
        label: "Community Reports",
      },
      {
        badgeCount: unreadResidentsCount,
        count: unreadResidentsCount,
        description: "Previous registrations you have not opened.",
        href: "/admin/residents",
        icon: UsersRound,
        label: "Resident Accounts",
      },
      {
        badgeCount: unreadDocumentsCount,
        count: unreadDocumentsCount,
        description: "Document requests you have not opened.",
        href: "/admin/documents",
        icon: FileBadge2,
        label: "Document Requests",
      },
    ].filter((item) => item.count > 0);
  }, [
    unreadDocumentsCount,
    unreadReportsCount,
    unreadResidentsCount,
  ]);
  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => !item.adminOnly || canViewAnalytics(role));
  }, [role]);

  const pageTitle = useMemo(() => {
    return (
      visibleNavItems.find((item) => displayedPath.startsWith(item.href))?.label ??
      "Admin"
    );
  }, [displayedPath, visibleNavItems]);
  const groupedSearchResults = useMemo(() => {
    return searchResults.reduce<Record<string, GlobalSearchResult[]>>(
      (groups, result) => {
        const group = groups[result.category] ?? [];
        group.push(result);
        groups[result.category] = group;
        return groups;
      },
      {},
    );
  }, [searchResults]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    async function checkAccess() {
      const adminSession = await getAdminServerSession(controller.signal);
      window.clearTimeout(timeout);
      const officeRole = adminSession?.role ?? null;

      if (!isMounted) return;

      if (!officeRole) {
        await clearAdminServerSession();
        router.replace("/admin/login");
        return;
      }

      if (
        pathname.startsWith("/admin/analytics") &&
        !canViewAnalytics(officeRole)
      ) {
        router.replace("/admin/dashboard");
        return;
      }

      if (
        pathname.startsWith("/admin/staff") &&
        !canManageOfficeAccounts(officeRole)
      ) {
        router.replace("/admin/dashboard");
        return;
      }

      setRole(officeRole);
      setIsChecking(false);
      void loadHeaderData();
      void refreshNotificationCounts();
    }

    async function loadHeaderData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      let resolvedName =
        user.user_metadata?.full_name?.toString().trim() ||
        user.email?.split("@")[0] ||
        "Admin";

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.full_name?.trim()) {
        resolvedName = data.full_name;
      }

      if (isMounted) setAdminName(resolvedName);
    }

    async function refreshNotificationCounts() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const ids = await fetchPendingNotificationIds();
        if (!isMounted) return;
        setOfficeUserId(session.user.id);
        setPendingIds(ids);
      } catch {
        // Retain the last successful counts instead of reporting a false zero.
        console.warn("Unable to refresh office notifications.");
      }
    }

    void checkAccess().catch(() => {
      window.clearTimeout(timeout);
      if (isMounted) setAccessFailed(true);
    });
    const timer = window.setInterval(refreshNotificationCounts, 15000);

    return () => {
      isMounted = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.clearInterval(timer);
    };
  }, [pathname, router, accessAttempt]);

  useEffect(() => {
    if (!isNotificationOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNotificationOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNotificationOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    const refreshReads = () => setReadRevision(value => value + 1);
    window.addEventListener(notificationReadEvent, refreshReads);
    window.addEventListener("storage", refreshReads);
    return () => {
      window.removeEventListener(notificationReadEvent, refreshReads);
      window.removeEventListener("storage", refreshReads);
    };
  }, []);

  useEffect(() => {
    setIsNotificationOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setIsSearchLoading(false);
      return;
    }

    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchLoading(true);
      setSearchError("");

      try {
        const results = await fetchGlobalSearchResults(normalizedQuery, role);
        if (!isCancelled) {
          setSearchResults(results);
          setIsSearchOpen(true);
        }
      } catch (error) {
        if (!isCancelled) {
          setSearchResults([]);
          setSearchError(
            error instanceof Error ? error.message : "Search failed.",
          );
          setIsSearchOpen(true);
        }
      } finally {
        if (!isCancelled) {
          setIsSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [role, searchQuery]);

  async function handleLogout() {
    await supabase.auth.signOut();
    await clearAdminServerSession();
    router.replace("/admin/login");
  }

  function navigateTo(href: string) {
    setIsSidebarOpen(false);
    if (href === pathname && !isNavigating) return;
    setDestination(href);
    startNavigation(() => router.push(href));
  }

  function openNotificationTarget(href: string) {
    setIsNotificationOpen(false);
    navigateTo(href);
  }

  function handleSearchResultOpen(result: GlobalSearchResult) {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    navigateTo(result.href);
  }

  if (accessFailed) {
    return <WorkspaceConnectionError onRetry={() => {
      setAccessFailed(false);
      setIsChecking(true);
      setAccessAttempt(attempt => attempt + 1);
    }} />;
  }

  if (isChecking) {
    return <WorkspaceLoader />;
  }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        id="workspace-navigation"
        className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}
      >
        <button
          className="mobile-nav-close"
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <Brand />
        <p className="sidebar-label">Workspace</p>
        <nav aria-label="Main navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = displayedPath.startsWith(item.href);
            const badge =
              item.href === "/admin/reports"
                ? unreadReportsCount
                : item.href === "/admin/residents"
                  ? unreadResidentsCount
                  : item.href === "/admin/documents"
                    ? unreadDocumentsCount
                    : 0;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "active" : ""}
                href={item.href}
                key={item.href}
                onNavigate={(event) => {
                  event.preventDefault();
                  navigateTo(item.href);
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {badge > 0 ? <em>{badge > 99 ? "99+" : badge}</em> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-access">
          <ShieldCheck size={17} />
          <span>
            {officeRoleLabel(role)} access
            <small>Authorized personnel only</small>
          </span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout} type="button">
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {isSidebarOpen ? (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="sidebar-toggle"
            aria-controls="workspace-navigation"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((value) => !value)}
            type="button"
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div
            className={`topbar-search ${isSearchOpen ? "open" : ""}`}
            ref={searchRef}
          >
            <div className="topbar-search-bar">
              <Search size={16} />
              <input
                aria-label="Search across the admin portal"
                placeholder="Search workspace…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2 || searchError) {
                    setIsSearchOpen(true);
                  }
                }}
              />
            </div>
            {isSearchOpen ? (
              <div
                ref={searchPanelRef}
                className="topbar-search-panel"
                role="region"
                aria-label="Global search results"
                popover="manual"
              >
                {isSearchLoading ? (
                  <div className="topbar-search-state">Searching...</div>
                ) : searchError ? (
                  <div className="topbar-search-state">{searchError}</div>
                ) : searchQuery.trim().length < 2 ? (
                  <div className="topbar-search-state">
                    Type at least 2 characters.
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="topbar-search-state">No results found.</div>
                ) : (
                  Object.entries(groupedSearchResults).map(
                    ([category, results]) => (
                      <div className="topbar-search-group" key={category}>
                        <strong>
                          {
                            globalSearchCategories[
                              category as GlobalSearchResult["category"]
                            ]
                          }
                        </strong>
                        <div className="topbar-search-group-list">
                          {results.map((result) => (
                            <button
                              className="topbar-search-result"
                              key={result.id}
                              onClick={() => handleSearchResultOpen(result)}
                              type="button"
                            >
                              <div className="topbar-search-copy">
                                <span>{result.title}</span>
                                <small>{result.subtitle}</small>
                              </div>
                              {result.badge ? (
                                <em
                                  className={`topbar-search-badge ${result.badgeTone ?? "info"}`}
                                >
                                  {result.badge}
                                </em>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            ) : null}
          </div>
          <div
            className={`notification-menu ${isNotificationOpen ? "open" : ""}`}
            ref={notificationRef}
          >
            <button
              aria-expanded={isNotificationOpen}
              aria-haspopup="dialog"
              aria-label="Open notifications"
              className="notification-button"
              onClick={() => setIsNotificationOpen((current) => !current)}
              type="button"
            >
              <Bell size={18} />
              {notificationCount > 0 ? (
                <span>
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : null}
            </button>
            {isNotificationOpen ? (
              <div
                ref={notificationPanelRef}
                className="notification-panel"
                role="dialog"
                aria-label="Notifications"
                popover="manual"
              >
                <div className="notification-panel-header">
                  <div>
                    <strong>Notifications</strong>
                    <p>Stay on top of pending barangay tasks.</p>
                  </div>
                  {notificationCount > 0 ? (
                    <em>
                      {notificationCount > 99 ? "99+" : notificationCount} unread
                    </em>
                  ) : null}
                </div>
                <div className="notification-panel-body">
                  {notificationItems.length > 0 ? (
                    notificationItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          className="notification-item"
                          key={item.href}
                          onClick={() => openNotificationTarget(item.href)}
                          type="button"
                        >
                          <span className="notification-item-icon">
                            <Icon size={18} />
                          </span>
                          <div className="notification-item-copy">
                            <strong>{item.label}</strong>
                            <p>{item.description}</p>
                            <small>
                              {item.count} unread item
                              {item.count === 1 ? "" : "s"}
                            </small>
                          </div>
                          <em>
                            {item.badgeCount > 99 ? "99+" : item.badgeCount} unread
                          </em>
                        </button>
                      );
                    })
                  ) : (
                    <div className="notification-empty">
                      <span className="notification-item-icon">
                        <Bell size={18} />
                      </span>
                      <div className="notification-item-copy">
                        <strong>No unread notifications</strong>
                        <p>All caught up for now.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="admin-account">
            <span>
              <ShieldCheck size={15} />
            </span>
            <strong>
              {adminName} · {officeRoleLabel(role)}
            </strong>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <AdminRoleProvider role={role}>{isNavigating && destination ? <AdminPageSkeleton href={destination} /> : children}</AdminRoleProvider>
        </main>
      </div>
    </div>
  );
}
