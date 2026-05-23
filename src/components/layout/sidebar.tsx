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
} from "lucide-react";
import { useState } from "react";

const navItems = [
  {
    group: "Tổng quan",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Vận hành",
    items: [
      { href: "/pl", label: "P&L & Dòng tiền", icon: TrendingUp },
      { href: "/publishers", label: "Publisher CRM", icon: Users },
      { href: "/advertisers", label: "Advertiser & Offer", icon: Building2 },
      { href: "/reconciliation", label: "Đối soát", icon: FileCheck },
    ],
  },
  {
    group: "Nội bộ",
    items: [
      { href: "/hr", label: "HR & Org Chart", icon: UserCog },
      { href: "/kpi", label: "KPI & Bonus", icon: Target },
      { href: "/contracts", label: "Hợp đồng", icon: FileText },
    ],
  },
  {
    group: "Giám sát",
    items: [
      { href: "/traffic", label: "Traffic Monitor", icon: Activity },
      { href: "/fraud", label: "Fraud Detection", icon: AlertTriangle },
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-gray-950 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800">
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
        {navItems.map((group) => (
          <div key={group.group} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
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
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-800 p-2">
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors",
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
