"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Building2,
  FileCheck,
  UserCog,
  Target,
  FileText,
  Activity,
  AlertTriangle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Kanban,
  GitPullRequest,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type { UserPermissions, ModuleSlug } from "@/lib/permissions";
import { canAccess } from "@/lib/permissions";

// ─── Nav definition ───────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  module: ModuleSlug;
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Tổng quan",
    items: [
      { href: "/dashboard",      label: "Dashboard",          icon: LayoutDashboard, module: "dashboard" },
    ],
  },
  {
    group: "Vận hành",
    items: [
      { href: "/pl",             label: "P&L & Dòng tiền",    icon: TrendingUp,      module: "pl" },
      { href: "/pipeline",       label: "Pipeline BD/PM",      icon: GitPullRequest,  module: "pipeline" },
      { href: "/publishers",     label: "Publisher CRM",       icon: Users,           module: "publishers" },
      { href: "/advertisers",    label: "Advertiser & Offer",  icon: Building2,       module: "advertisers" },
      { href: "/reconciliation", label: "Đối soát",            icon: FileCheck,       module: "reconciliation" },
      { href: "/tasks",          label: "Công việc",           icon: Kanban,          module: "tasks" },
    ],
  },
  {
    group: "Nội bộ",
    items: [
      { href: "/hr",             label: "HR & Org Chart",      icon: UserCog,         module: "hr" },
      { href: "/kpi",            label: "KPI & Bonus",         icon: Target,          module: "kpi" },
      { href: "/contracts",      label: "Hợp đồng",            icon: FileText,        module: "contracts" },
    ],
  },
  {
    group: "Giám sát",
    items: [
      { href: "/traffic",        label: "Traffic Monitor",     icon: Activity,        module: "traffic" },
      { href: "/fraud",          label: "Fraud Detection",     icon: AlertTriangle,   module: "fraud" },
      { href: "/settings",       label: "Cài đặt",             icon: Settings,        module: "settings" },
    ],
  },
];

// Super admin-only items (always shown only to super admins)
const ADMIN_ITEMS: NavItem[] = [
  { href: "/permissions", label: "Phân quyền", icon: ShieldCheck, module: "permissions" },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  userPerms: UserPermissions | null;
}

export function Sidebar({ userPerms }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isSuperAdmin = userPerms?.is_super_admin ?? false;

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-600 text-white"
            : "text-gray-400 hover:bg-gray-800 hover:text-white",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-gray-950 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-blue-400">Cityads</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto rounded-md p-1.5 hover:bg-gray-800"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            canAccess(userPerms, item.module)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group.group}
                </p>
              )}
              {visibleItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          );
        })}

        {/* Super admin section */}
        {isSuperAdmin && (
          <div className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-red-400">
                Admin
              </p>
            )}
            {ADMIN_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        )}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-800 p-2">
        {!collapsed && userPerms && (
          <div className="mb-1 px-3 py-1">
            <p className="truncate text-xs font-medium text-gray-300">
              {userPerms.display_name ?? userPerms.email}
            </p>
            <p className="text-[10px] text-gray-500">
              {userPerms.is_super_admin ? "Super Admin" : "Nhân viên"}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Đăng xuất" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}
