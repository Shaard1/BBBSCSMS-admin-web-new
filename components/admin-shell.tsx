"use client";

import {
  BarChart3,
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Menu,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AdminRoleProvider } from "@/components/admin-role-context";
import { RingLoader } from "@/components/ring-loader";
import { clearAdminServerSession, getAdminServerSession } from "@/lib/auth";
import {
  canManageOfficeAccounts,
  canViewAnalytics,
  officeRoleLabel,
  type OfficeRole
} from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type AdminShellProps = {
  children: ReactNode;
};

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, adminOnly: true },
  { label: "Staff Accounts", href: "/admin/staff", icon: UserCog, adminOnly: true },
  { label: "Community Reports", href: "/admin/reports", icon: FileText },
  { label: "Complaint Map", href: "/admin/map", icon: MapPinned },
  { label: "Resident Verification", href: "/admin/residents", icon: UsersRound },
  { label: "Announcement", href: "/admin/announcements", icon: Megaphone }
];

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [role, setRole] = useState<OfficeRole>("staff");
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [pendingResidentsCount, setPendingResidentsCount] = useState(0);

  const notificationCount = pendingReportsCount + pendingResidentsCount;
  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => !item.adminOnly || canViewAnalytics(role));
  }, [role]);

  const pageTitle = useMemo(() => {
    return visibleNavItems.find((item) => pathname.startsWith(item.href))?.label ?? "Admin";
  }, [pathname, visibleNavItems]);

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      const adminSession = await getAdminServerSession();
      const officeRole = adminSession?.role ?? null;

      if (!isMounted) return;

      if (!officeRole) {
        await clearAdminServerSession();
        router.replace("/admin/login");
        return;
      }

      if (pathname.startsWith("/admin/analytics") && !canViewAnalytics(officeRole)) {
        router.replace("/admin/dashboard");
        return;
      }

      if (pathname.startsWith("/admin/staff") && !canManageOfficeAccounts(officeRole)) {
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
        data: { user }
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
      const [{ count: reportsCount }, { count: residentsCount }] = await Promise.all([
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("residents")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      ]);

      if (!isMounted) return;

      setPendingReportsCount(reportsCount ?? 0);
      setPendingResidentsCount(residentsCount ?? 0);
    }

    void checkAccess();
    const timer = window.setInterval(refreshNotificationCounts, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    await clearAdminServerSession();
    router.replace("/admin/login");
  }

  if (isChecking) {
    return (
      <main className="admin-loading">
        <RingLoader label="Checking admin access..." />
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <Image src="/assets/BBBC.png" alt="" width={44} height={44} />
          <div>
            <strong>{officeRoleLabel(role)} Portal</strong>
            <span>Community Management</span>
          </div>
        </div>
        <p className="sidebar-label">Main menu</p>
        <nav>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const badge =
              item.href === "/admin/reports"
                ? pendingReportsCount
                : item.href === "/admin/residents"
                  ? pendingResidentsCount
                  : 0;

            return (
              <Link
                className={isActive ? "active" : ""}
                href={item.href}
                key={item.href}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {badge > 0 ? <em>{badge > 99 ? "99+" : badge}</em> : null}
              </Link>
            );
          })}
        </nav>
        <button className="sidebar-logout" onClick={handleLogout} type="button">
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen((value) => !value)}
            type="button"
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1>{pageTitle}</h1>
          <div className="topbar-search">
            <Search size={16} />
            <input aria-label="Search" placeholder="Search..." />
          </div>
          <button className="notification-button" type="button">
            <Bell size={18} />
            {notificationCount > 0 ? <span>{notificationCount > 99 ? "99+" : notificationCount}</span> : null}
          </button>
          <div className="admin-account">
            <span><ShieldCheck size={15} /></span>
            <strong>{adminName} · {officeRoleLabel(role)}</strong>
          </div>
        </header>
        <AdminRoleProvider role={role}>{children}</AdminRoleProvider>
      </section>
    </main>
  );
}
