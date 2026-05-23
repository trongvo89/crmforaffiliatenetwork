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

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  role: "pm" | "bd" | "am" | "admin" | "custom";
  custom_role_name: string | null;
  base_salary: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ROLE_LABELS: Record<Employee["role"], string> = {
  pm: "Project Manager",
  bd: "Business Development",
  am: "Account Manager",
  admin: "Admin",
  custom: "Khác",
};

const ROLE_COLORS: Record<Employee["role"], { badge: string; dot: string }> = {
  pm: { badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  bd: { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  am: { badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  admin: { badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  custom: { badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
};

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
  return ROLE_LABELS[emp.role];
}

interface HrClientProps {
  initialEmployees: Employee[];
  companyId: string;
}

export function HrClient({ initialEmployees, companyId }: HrClientProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<Employee[]>(initialEmployees);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null);

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.length - activeCount;

  const roleGroups = React.useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    for (const role of ["pm", "bd", "am", "admin", "custom"] as Employee["role"][]) {
      const group = employees.filter((e) => e.role === role && e.is_active);
      if (group.length > 0) groups[role] = group;
    }
    return groups;
  }, [employees]);

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
    if (!window.confirm(`Xóa nhân viên "${emp.name}"?`)) return;
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
          <p className="text-sm text-muted-foreground mt-0.5">
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

      {/* Org chart section */}
      {Object.keys(roleGroups).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Sơ đồ tổ chức</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(roleGroups) as [Employee["role"], Employee[]][]).map(([role, members]) => (
              <div
                key={role}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("inline-block h-2.5 w-2.5 rounded-full", ROLE_COLORS[role].dot)} />
                  <span className="font-medium text-gray-900">{ROLE_LABELS[role]}</span>
                  <span className="ml-auto text-sm text-muted-foreground">{members.length} người</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {members.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-1.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className={cn("text-xs font-medium", ROLE_COLORS[role].badge)}>
                          {getInitials(emp.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-700">{emp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee table */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Danh sách nhân viên</h2>

        {employees.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
            <Users className="h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">Chưa có nhân viên nào</p>
            <p className="text-sm text-gray-400">Thêm nhân viên đầu tiên để bắt đầu</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm nhân viên
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
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
                            className={cn("text-xs font-medium", ROLE_COLORS[emp.role].badge)}
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
                          ROLE_COLORS[emp.role].badge
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
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
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
