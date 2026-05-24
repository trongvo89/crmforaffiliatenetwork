"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Employee } from "../hr-client";

const ROLE_LABELS = {
  pm: "Project Manager",
  bd: "Business Development",
  am: "Account Manager",
  admin: "Admin",
  it: "IT",
  custom: "Khác",
};

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  employee: Employee | null;
  onSaved: (emp: Employee) => void;
}

export function EmployeeForm({
  open,
  onOpenChange,
  companyId,
  employee,
  onSaved,
}: EmployeeFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Employee["role"]>("bd");
  const [customRoleName, setCustomRoleName] = React.useState("");
  const [baseSalary, setBaseSalary] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  const isEdit = employee !== null;

  React.useEffect(() => {
    if (open) {
      if (employee) {
        setName(employee.name);
        setEmail(employee.email ?? "");
        setRole(employee.role);
        setCustomRoleName(employee.custom_role_name ?? "");
        setBaseSalary(employee.base_salary != null ? String(employee.base_salary) : "");
        setIsActive(employee.is_active);
      } else {
        setName("");
        setEmail("");
        setRole("bd");
        setCustomRoleName("");
        setBaseSalary("");
        setIsActive(true);
      }
    }
  }, [open, employee]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên nhân viên", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        role,
        custom_role_name: role === "custom" ? customRoleName.trim() || null : null,
        base_salary: baseSalary !== "" ? Number(baseSalary) : null,
        ...(isEdit ? { is_active: isActive } : {}),
      };

      if (isEdit && employee) {
        const { data, error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", employee.id)
          .eq("company_id", companyId)
          .select("*")
          .single();

        if (error) throw error;
        toast({ title: "Đã cập nhật nhân viên" });
        onSaved(data as Employee);
      } else {
        const { data, error } = await supabase
          .from("employees")
          .insert({ ...payload, company_id: companyId, is_active: true })
          .select("*")
          .single();

        if (error) throw error;
        toast({ title: "Đã thêm nhân viên" });
        onSaved(data as Employee);
      }

      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể lưu nhân viên",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Cập nhật thông tin nhân viên." : "Điền thông tin để thêm nhân viên mới."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Tên *</Label>
            <Input
              id="emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input
              id="emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Employee["role"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ROLE_LABELS) as [Employee["role"], string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="emp-custom-role">Tên vai trò tùy chỉnh</Label>
              <Input
                id="emp-custom-role"
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                placeholder="VD: Designer, Copywriter..."
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="emp-salary">Lương cơ bản (triệu VNĐ)</Label>
            <Input
              id="emp-salary"
              type="number"
              min={0}
              step={0.5}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="VD: 15"
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <input
                id="emp-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="emp-active" className="cursor-pointer">
                Đang hoạt động
              </Label>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Cập nhật" : "Thêm nhân viên"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
