"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users, UserCheck, UserX } from "lucide-react";
import { EmployeeForm } from "./components/employee-form";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmployeeRole =
  | "head_account"
  | "head_cs"
  | "account_manager"
  | "publisher_manager"
  | "koc_manager"
  | "it"
  | "intern_account"
  | "intern_publisher"
  | "intern_koc"
  | "admin"
  | "custom"
  // legacy (kept for backward compat)
  | "pm"
  | "bd"
  | "am";

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  role: EmployeeRole;
  custom_role_name: string | null;
  base_salary: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Role metadata ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  head_account: "Head of Account",
  head_cs: "Head of Client Service",
  account_manager: "Account Manager",
  publisher_manager: "Publisher Manager",
  koc_manager: "KOC Manager",
  it: "IT",
  intern_account: "Intern Account Manager",
  intern_publisher: "Intern Publisher Manager",
  intern_koc: "Intern KOC Manager",
  admin: "Admin",
  custom: "Khác",
  // legacy
  pm: "Project Manager (cũ)",
  bd: "Business Development (cũ)",
  am: "Account Manager (cũ)",
};

const ROLE_COLORS: Record<EmployeeRole, { badge: string; dot: string; border: string }> = {
  head_account:     { badge: "bg-blue-100 text-blue-800",   dot: "bg-blue-600",   border: "border-blue-400" },
  head_cs:          { badge: "bg-purple-100 text-purple-800", dot: "bg-purple-600", border: "border-purple-400" },
  account_manager:  { badge: "bg-sky-100 text-sky-700",     dot: "bg-sky-500",    border: "border-sky-300" },
  publisher_manager:{ badge: "bg-violet-100 text-violet-700",dot: "bg-violet-500", border: "border-violet-300" },
  koc_manager:      { badge: "bg-indigo-100 text-indigo-700",dot: "bg-indigo-500", border: "border-indigo-300" },
  it:               { badge: "bg-cyan-100 text-cyan-700",   dot: "bg-cyan-500",   border: "border-cyan-300" },
  intern_account:   { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400",  border: "border-slate-300" },
  intern_publisher: { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400",  border: "border-slate-300" },
  intern_koc:       { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400",  border: "border-slate-300" },
  admin:            { badge: "bg-orange-100 text-orange-700",dot: "bg-orange-500", border: "border-orange-300" },
  custom:           { badge: "bg-gray-100 text-gray-600",   dot: "bg-gray-400",   border: "border-gray-300" },
  pm:               { badge: "bg-gray-100 text-gray-500",   dot: "bg-gray-400",   border: "border-gray-200" },
  bd:               { badge: "bg-gray-100 text-gray-500",   dot: "bg-gray-400",   border: "border-gray-200" },
  am:               { badge: "bg-gray-100 text-gray-500",   dot: "bg-gray-400",   border: "border-gray-200" },
};

// ─── Org tree definition ───────────────────────────────────────────────────────

interface TreeNode {
  role: EmployeeRole;
  children?: TreeNode[];
}

const MAIN_BRANCHES: TreeNode[] = [
  {
    role: "head_account",
    children: [
      {
        role: "account_manager",
        children: [{ role: "intern_account" }],
      },
    ],
  },
  {
    role: "head_cs",
    children: [
      {
        role: "publisher_manager",
        children: [{ role: "intern_publisher" }],
      },
      {
        role: "koc_manager",
        children: [{ role: "intern_koc" }],
      },
    ],
  },
];

const STANDALONE_ROLES: EmployeeRole[] = ["it", "admin"];

// ─── Org Chart Components ─────────────────────────────────────────────────────

function OrgRoleCard({
  role,
  members,
  isHead = false,
}: {
  role: EmployeeRole;
  members: Employee[];
  isHead?: boolean;
}) {
  const { dot, border, badge } = ROLE_COLORS[role];
  const lastName = (name: string) => name.split(" ").pop() ?? name;

  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-white p-3 shadow-sm",
        border,
        isHead ? "min-w-[180px]" : "min-w-[160px]"
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
        <span className={cn("leading-tight font-bold text-gray-800", isHead ? "text-xs" : "text-xs")}>
          {ROLE_LABELS[role]}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          {members.length}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-[10px] italic text-gray-300">Chưa có nhân viên</p>
      ) : (
        <div className="space-y-1">
          {members.map((emp) => (
            <div key={emp.id} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  badge
                )}
              >
                {lastName(emp.name)[0]?.toUpperCase()}
              </span>
              <span className="truncate text-xs text-gray-700">{lastName(emp.name)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Recursive tree node — renders a role card then its children indented below
function OrgTreeNode({
  node,
  byRole,
  depth = 0,
}: {
  node: TreeNode;
  byRole: (r: EmployeeRole) => Employee[];
  depth?: number;
}) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col">
      <OrgRoleCard role={node.role} members={byRole(node.role)} isHead={depth === 0} />

      {hasChildren && (
        <div className="ml-5 mt-0 border-l-2 border-gray-200 pl-4">
          {node.children!.map((child) => (
            <div key={child.role} className="mt-3">
              <OrgTreeNode node={child} byRole={byRole} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgChart({ employees }: { employees: Employee[] }) {
  const active = employees.filter((e) => e.is_active);
  const byRole = (role: EmployeeRole) => active.filter((e) => e.role === role);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Sơ đồ tổ chức
      </h2>

      {/* Two main branches side by side */}
      <div className="flex flex-wrap gap-8">
        {MAIN_BRANCHES.map((branch) => (
          <OrgTreeNode key={branch.role} node={branch} byRole={byRole} depth={0} />
        ))}
      </div>

      {/* Standalone roles */}
      <div className="mt-6 border-t pt-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Bộ phận hỗ trợ
        </p>
        <div className="flex flex-wrap gap-3">
          {STANDALONE_ROLES.map((role) => (
            <OrgRoleCard key={role} role={role} members={byRole(role)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getRoleDisplayName(emp: Employee): string {
  if (emp.role === "custom" && emp.custom_role_name) return emp.custom_role_name;
  return ROLE_LABELS[emp.role] ?? emp.role;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface HrClientProps {
  initialEmployees: Employee[];
  companyId: string;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function HrClient({ initialEmployees, companyId }: HrClientProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<Employee[]>(initialEmployees);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.length - activeCount;

  function openCreate() {
    setEditingEmployee(null);
    setFormOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    setFormOpen(true);
  }

  function handleSaved(emp: Employee) {
    setEmployees((prev) => {
      const idx = prev.findIndex((e) => e.id === emp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = emp;
        return next;
      }
      return [emp, ...prev];
    });
  }

  async function handleDelete(emp: Employee) {
    if (deletingId) return;
    if (!window.confirm(`Xóa nhân viên "${emp.name}"?`)) return;
    setDeletingId(emp.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", emp.id)
        .eq("company_id", companyId);

      if (error) {
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
        return;
      }
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      toast({ title: "Đã xóa nhân viên" });
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(emp: Employee) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("employees")
      .update({ is_active: !emp.is_active })
      .eq("id", emp.id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? (data as Employee) : e)));
    toast({ title: data.is_active ? "Đã kích hoạt" : "Đã vô hiệu hóa" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR & Org Chart</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quản lý nhân sự và sơ đồ tổ chức
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm nhân viên
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng nhân viên</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Đang hoạt động</p>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <UserX className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Không hoạt động</p>
              <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Org chart */}
      <OrgChart employees={employees} />

      {/* Employee table */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Danh sách nhân viên</h2>

        {employees.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
            <Users className="h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">Chưa có nhân viên nào</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm nhân viên
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Lương cơ bản</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={cn("text-xs font-medium", ROLE_COLORS[emp.role]?.badge ?? "bg-gray-100 text-gray-600")}
                          >
                            {getInitials(emp.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ROLE_COLORS[emp.role]?.badge ?? "bg-gray-100 text-gray-600"
                        )}
                      >
                        {getRoleDisplayName(emp)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {emp.base_salary != null ? formatCurrency(emp.base_salary) : "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(emp)}
                        title={emp.is_active ? "Nhấn để vô hiệu hóa" : "Nhấn để kích hoạt"}
                      >
                        <Badge
                          className={cn(
                            "cursor-pointer border-transparent",
                            emp.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          )}
                        >
                          {emp.is_active ? "Hoạt động" : "Không hoạt động"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(emp)}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          disabled={deletingId === emp.id}
                          onClick={() => handleDelete(emp)}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        employee={editingEmployee}
        onSaved={handleSaved}
      />
    </div>
  );
}
