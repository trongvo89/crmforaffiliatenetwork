// ─── Module registry ──────────────────────────────────────────────────────────

export type ModuleSlug =
  | "dashboard"
  | "pl"
  | "pipeline"
  | "publishers"
  | "advertisers"
  | "reconciliation"
  | "tasks"
  | "hr"
  | "kpi"
  | "contracts"
  | "traffic"
  | "fraud"
  | "settings"
  | "permissions";

export const ALL_MODULES: { slug: ModuleSlug; label: string; group: string }[] = [
  { slug: "dashboard",      label: "Dashboard",           group: "Tổng quan" },
  { slug: "pl",             label: "P&L & Dòng tiền",     group: "Vận hành" },
  { slug: "pipeline",       label: "Pipeline BD/PM",       group: "Vận hành" },
  { slug: "publishers",     label: "Publisher CRM",        group: "Vận hành" },
  { slug: "advertisers",    label: "Advertiser & Offer",   group: "Vận hành" },
  { slug: "reconciliation", label: "Đối soát",             group: "Vận hành" },
  { slug: "tasks",          label: "Công việc",            group: "Vận hành" },
  { slug: "hr",             label: "HR & Org Chart",       group: "Nội bộ" },
  { slug: "kpi",            label: "KPI & Bonus",          group: "Nội bộ" },
  { slug: "contracts",      label: "Hợp đồng",             group: "Nội bộ" },
  { slug: "traffic",        label: "Traffic Monitor",      group: "Giám sát" },
  { slug: "fraud",          label: "Fraud Detection",      group: "Giám sát" },
  { slug: "settings",       label: "Cài đặt",              group: "Giám sát" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserPermissions {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  is_super_admin: boolean;
  allowed_modules: ModuleSlug[];
  created_at: string;
  updated_at: string;
}

// ─── Access check ─────────────────────────────────────────────────────────────

export function canAccess(
  perms: UserPermissions | null | undefined,
  module: ModuleSlug
): boolean {
  if (!perms) return false;
  if (perms.is_super_admin) return true;
  return perms.allowed_modules.includes(module);
}
