"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  ShieldOff,
  Users,
  RefreshCw,
  UserPlus,
  Trash2,
  X,
  Mail,
  AlertCircle,
} from "lucide-react";
import { ALL_MODULES, canAccess } from "@/lib/permissions";
import type { UserPermissions, ModuleSlug } from "@/lib/permissions";

interface PermissionsClientProps {
  currentUserId: string;
  allPerms: UserPermissions[];
}

const MODULE_GROUPS = Array.from(
  new Map(ALL_MODULES.map((m) => [m.group, m.group])).keys()
).map((group) => ({
  group,
  modules: ALL_MODULES.filter((m) => m.group === group),
}));

// ─── Invite Dialog ─────────────────────────────────────────────────────────────

interface InviteDialogProps {
  onClose: () => void;
  onSuccess: (perm: UserPermissions) => void;
}

function InviteDialog({ onClose, onSuccess }: InviteDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [selectedModules, setSelectedModules] = React.useState<ModuleSlug[]>([]);
  const [loading, setLoading] = React.useState(false);

  function toggleModule(slug: ModuleSlug) {
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((m) => m !== slug) : [...prev, slug]
    );
  }

  function selectAllModules() {
    setSelectedModules(ALL_MODULES.map((m) => m.slug));
  }

  function clearModules() {
    setSelectedModules([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          display_name: displayName.trim() || undefined,
          is_super_admin: isSuperAdmin,
          allowed_modules: isSuperAdmin ? [] : selectedModules,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Có lỗi xảy ra");
      }

      toast({ title: `Đã gửi lời mời đến ${email}` });
      onSuccess(data.perm as UserPermissions);
      onClose();
    } catch (err) {
      toast({
        title: "Mời thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Mời người dùng mới</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Người dùng sẽ nhận email mời và tự đặt mật khẩu lần đầu
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="ten@congty.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Tên hiển thị</Label>
            <Input
              id="invite-name"
              placeholder="Nguyễn Văn A"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Super admin toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <input
              type="checkbox"
              id="invite-superadmin"
              checked={isSuperAdmin}
              onChange={(e) => setIsSuperAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-red-600"
            />
            <label htmlFor="invite-superadmin" className="flex-1 cursor-pointer">
              <span className="block text-sm font-medium text-gray-800">Super Admin</span>
              <span className="block text-xs text-gray-500">
                Truy cập toàn bộ hệ thống, không cần phân quyền từng module
              </span>
            </label>
            <ShieldCheck
              className={cn("h-5 w-5", isSuperAdmin ? "text-red-500" : "text-gray-300")}
            />
          </div>

          {/* Module permissions (only when not super admin) */}
          {!isSuperAdmin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quyền truy cập module</Label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllModules}
                    className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={clearModules}
                    className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Xóa hết
                  </button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y">
                {MODULE_GROUPS.map(({ group, modules }) => (
                  <div key={group} className="px-3 py-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {group}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {modules.map((mod) => {
                        const checked = selectedModules.includes(mod.slug);
                        return (
                          <button
                            key={mod.slug}
                            type="button"
                            onClick={() => toggleModule(mod.slug)}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                              checked
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600"
                            )}
                          >
                            {mod.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {selectedModules.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Chưa chọn module nào — người dùng sẽ không thể truy cập bất kỳ tính năng nào
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Gửi lời mời
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PermissionsClient({
  currentUserId,
  allPerms: initialPerms,
}: PermissionsClientProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const [perms, setPerms] = React.useState<UserPermissions[]>(initialPerms);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [showInvite, setShowInvite] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  // ── Toggle super admin ────────────────────────────────────────────────────────

  async function toggleSuperAdmin(target: UserPermissions) {
    if (target.user_id === currentUserId) {
      toast({
        title: "Không thể tự thay đổi quyền Super Admin của mình.",
        variant: "destructive",
      });
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

  // ── Toggle single module ───────────────────────────────────────────────────────

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

  // ── Grant / revoke all ─────────────────────────────────────────────────────────

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
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Có lỗi.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  // ── Remove user ────────────────────────────────────────────────────────────────

  async function removeUser(target: UserPermissions) {
    if (target.user_id === currentUserId) {
      toast({ title: "Không thể xóa tài khoản của chính mình.", variant: "destructive" });
      return;
    }

    const confirmed = window.confirm(
      `Xóa tài khoản "${target.display_name ?? target.email}"?\n\nHành động này không thể hoàn tác — tài khoản sẽ bị xóa khỏi hệ thống.`
    );
    if (!confirmed) return;

    setRemovingId(target.id);
    try {
      const res = await fetch("/api/admin/remove-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.user_id, permId: target.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");

      setPerms((prev) => prev.filter((p) => p.id !== target.id));
      toast({ title: `Đã xóa tài khoản ${target.display_name ?? target.email}` });
    } catch (err) {
      toast({
        title: "Xóa thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  }

  // ── Invite success ─────────────────────────────────────────────────────────────

  function handleInviteSuccess(newPerm: UserPermissions) {
    setPerms((prev) => [...prev, newPerm]);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Phân quyền hệ thống</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Quản lý quyền truy cập các tính năng cho từng tài khoản.
            </p>
          </div>
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Mời người dùng
          </Button>
        </div>

        {perms.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
            <Users className="h-10 w-10 text-gray-300" />
            <p className="text-gray-500">Chưa có tài khoản nào trong hệ thống</p>
            <Button variant="outline" onClick={() => setShowInvite(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Mời người dùng đầu tiên
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {perms.map((p) => {
              const isSelf = p.user_id === currentUserId;
              const isSuperAdmin = p.is_super_admin;
              const isSavingThis = saving === p.id;
              const isRemoving = removingId === p.id;

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
                          isSuperAdmin ? "bg-red-500" : "bg-blue-500"
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
                        disabled={isSelf || isSavingThis || isRemoving}
                        onClick={() => toggleSuperAdmin(p)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                          isSuperAdmin
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                          (isSelf || isSavingThis || isRemoving) && "cursor-not-allowed opacity-50"
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
                            disabled={!!saving || isRemoving}
                            onClick={() => setAllModules(p, true)}
                          >
                            Cấp tất cả
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={!!saving || isRemoving}
                            onClick={() => setAllModules(p, false)}
                          >
                            Thu hồi tất cả
                          </Button>
                        </>
                      )}

                      {/* Remove user */}
                      {!isSelf && (
                        <button
                          disabled={isRemoving || !!saving}
                          onClick={() => removeUser(p)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600",
                            (isRemoving || !!saving) && "cursor-not-allowed opacity-40"
                          )}
                          title="Xóa tài khoản"
                        >
                          {isRemoving ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
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
                        <div
                          key={group}
                          className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
                        >
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
                                  disabled={!!saving || isRemoving}
                                  onClick={() => toggleModule(p, mod.slug)}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                    granted
                                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                      : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600",
                                    (saving || isRemoving) && "opacity-60"
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
    </>
  );
}
