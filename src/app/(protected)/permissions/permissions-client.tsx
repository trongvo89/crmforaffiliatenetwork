"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldOff, Users, RefreshCw } from "lucide-react";
import { ALL_MODULES, canAccess } from "@/lib/permissions";
import type { UserPermissions, ModuleSlug } from "@/lib/permissions";

interface PermissionsClientProps {
  currentUserId: string;
  allPerms: UserPermissions[];
}

// Group ALL_MODULES by group for display
const MODULE_GROUPS = Array.from(
  new Map(ALL_MODULES.map((m) => [m.group, m.group])).keys()
).map((group) => ({
  group,
  modules: ALL_MODULES.filter((m) => m.group === group),
}));

export function PermissionsClient({
  currentUserId,
  allPerms: initialPerms,
}: PermissionsClientProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const [perms, setPerms] = React.useState<UserPermissions[]>(initialPerms);
  const [saving, setSaving] = React.useState<string | null>(null);

  // ── Toggle super admin ───────────────────────────────────────────────────────

  async function toggleSuperAdmin(target: UserPermissions) {
    if (target.user_id === currentUserId) {
      toast({ title: "Không thể tự thay đổi quyền Super Admin của mình.", variant: "destructive" });
      return;
    }

    const newVal = !target.is_super_admin;
    setSaving(target.id);
    try {
      const { error } = await supabase
        .from("user_permissions")
        .update({ is_super_admin: newVal, updated_at: new Date().toISOString() })
        .eq("id", target.id);

      if (error) throw error;

      setPerms((prev) =>
        prev.map((p) => (p.id === target.id ? { ...p, is_super_admin: newVal } : p))
      );
      toast({
        title: newVal
          ? `Đã cấp Super Admin cho ${target.display_name ?? target.email}`
          : `Đã thu hồi Super Admin của ${target.display_name ?? target.email}`,
      });
    } catch (err) {
      toast({
        title: "Lưu thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  // ── Toggle single module ──────────────────────────────────────────────────────

  async function toggleModule(target: UserPermissions, module: ModuleSlug) {
    const current = target.allowed_modules ?? [];
    const next: ModuleSlug[] = current.includes(module)
      ? current.filter((m) => m !== module)
      : [...current, module];

    setSaving(`${target.id}:${module}`);
    try {
      const { error } = await supabase
        .from("user_permissions")
        .update({ allowed_modules: next, updated_at: new Date().toISOString() })
        .eq("id", target.id);

      if (error) throw error;

      setPerms((prev) =>
        prev.map((p) => (p.id === target.id ? { ...p, allowed_modules: next } : p))
      );
    } catch (err) {
      toast({
        title: "Lưu thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  // ── Grant / revoke all modules for a user ────────────────────────────────────

  async function setAllModules(target: UserPermissions, grantAll: boolean) {
    const next: ModuleSlug[] = grantAll ? ALL_MODULES.map((m) => m.slug) : [];
    setSaving(target.id);
    try {
      const { error } = await supabase
        .from("user_permissions")
        .update({ allowed_modules: next, updated_at: new Date().toISOString() })
        .eq("id", target.id);

      if (error) throw error;

      setPerms((prev) =>
        prev.map((p) => (p.id === target.id ? { ...p, allowed_modules: next } : p))
      );
      toast({ title: grantAll ? "Đã cấp tất cả quyền" : "Đã thu hồi tất cả quyền" });
    } catch (err) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Có lỗi.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phân quyền hệ thống</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Quản lý quyền truy cập các tính năng cho từng tài khoản.
          Người dùng phải đăng nhập ít nhất một lần để xuất hiện ở đây.
        </p>
      </div>

      {perms.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
          <Users className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">Chưa có tài khoản nào đăng nhập vào hệ thống</p>
        </div>
      ) : (
        <div className="space-y-5">
          {perms.map((p) => {
            const isSelf = p.user_id === currentUserId;
            const isSuperAdmin = p.is_super_admin;
            const isSavingThis = saving === p.id;

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border bg-white shadow-sm",
                  isSelf && "ring-2 ring-blue-500"
                )}
              >
                {/* User header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                        isSuperAdmin ? "bg-red-500" : "bg-gray-400"
                      )}
                    >
                      {(p.display_name ?? p.email)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {p.display_name ?? p.email}
                        {isSelf && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Bạn
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{p.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Super admin toggle */}
                    <button
                      disabled={isSelf || isSavingThis}
                      onClick={() => toggleSuperAdmin(p)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        isSuperAdmin
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        (isSelf || isSavingThis) && "cursor-not-allowed opacity-50"
                      )}
                    >
                      {isSuperAdmin ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5" />
                      )}
                      {isSuperAdmin ? "Super Admin" : "Nhân viên"}
                    </button>

                    {/* Grant/revoke all (not for super admin) */}
                    {!isSuperAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!!saving}
                          onClick={() => setAllModules(p, true)}
                        >
                          Cấp tất cả
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={!!saving}
                          onClick={() => setAllModules(p, false)}
                        >
                          Thu hồi tất cả
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Module toggles */}
                {isSuperAdmin ? (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-400 italic">
                      Super Admin có quyền truy cập tất cả tính năng.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {MODULE_GROUPS.map(({ group, modules }) => (
                      <div key={group} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                        <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {group}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {modules.map((mod) => {
                            const granted = canAccess(p, mod.slug);
                            const isSavingModule = saving === `${p.id}:${mod.slug}`;

                            return (
                              <button
                                key={mod.slug}
                                disabled={!!saving}
                                onClick={() => toggleModule(p, mod.slug)}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                  granted
                                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                    : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600",
                                  saving && "opacity-60"
                                )}
                              >
                                {isSavingModule ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      granted ? "bg-green-500" : "bg-gray-300"
                                    )}
                                  />
                                )}
                                {mod.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
