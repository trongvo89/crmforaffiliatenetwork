"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublisherForm, type Publisher } from "./components/publisher-form";
import { PublisherDetail } from "./components/publisher-detail";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Tier badge ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<Publisher["tier"], string> = {
  Platinum: "bg-violet-100 text-violet-800",
  Gold: "bg-amber-100 text-amber-800",
  Silver: "bg-slate-100 text-slate-700",
  Bronze: "bg-orange-100 text-orange-800",
};

function TierBadge({ tier }: { tier: Publisher["tier"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TIER_COLORS[tier]
      )}
    >
      {tier}
    </span>
  );
}

// ─── Traffic source labels ────────────────────────────────────────────────────

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  native: "Native",
  email: "Email",
  push: "Push",
  seo: "SEO",
  other: "Khác",
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-green-500" : "bg-gray-400"
        )}
      />
      {isActive ? "Hoạt động" : "Ẩn"}
    </span>
  );
}

// ─── Tier filter options ──────────────────────────────────────────────────────

type TierFilter = "all" | "Platinum" | "Gold" | "Silver" | "Bronze";
type StatusFilter = "all" | "active" | "inactive";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublishersClientProps {
  initialPublishers: Publisher[];
  companyId: string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PublishersClient({
  initialPublishers,
  companyId,
}: PublishersClientProps) {
  // State
  const [publishers, setPublishers] =
    React.useState<Publisher[]>(initialPublishers);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [tierFilter, setTierFilter] = React.useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  // Form dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingPublisher, setEditingPublisher] =
    React.useState<Publisher | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedPublisher, setSelectedPublisher] =
    React.useState<Publisher | null>(null);

  // Sort state
  const [sortKey, setSortKey] = React.useState<keyof Publisher | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAdd() {
    setEditingPublisher(null);
    setFormOpen(true);
  }

  function handleEdit(publisher: Publisher) {
    setEditingPublisher(publisher);
    setFormOpen(true);
  }

  function handleView(publisher: Publisher) {
    setSelectedPublisher(publisher);
    setDetailOpen(true);
  }

  function handleFormSuccess(saved: Publisher) {
    setPublishers((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    // If the detail panel is showing the updated publisher, refresh it
    if (selectedPublisher?.id === saved.id) {
      setSelectedPublisher(saved);
    }
  }

  function handleSort(key: keyof Publisher) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = React.useMemo(() => {
    let result = [...publishers];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.email && p.email.toLowerCase().includes(q))
      );
    }

    // Tier filter
    if (tierFilter !== "all") {
      result = result.filter((p) => p.tier === tierFilter);
    }

    // Status filter
    if (statusFilter === "active") {
      result = result.filter((p) => p.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((p) => !p.is_active);
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), "vi");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [publishers, searchQuery, tierFilter, statusFilter, sortKey, sortDir]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = React.useMemo(() => {
    const total = publishers.length;
    const active = publishers.filter((p) => p.is_active).length;
    const byTier = {
      Platinum: publishers.filter((p) => p.tier === "Platinum").length,
      Gold: publishers.filter((p) => p.tier === "Gold").length,
      Silver: publishers.filter((p) => p.tier === "Silver").length,
      Bronze: publishers.filter((p) => p.tier === "Bronze").length,
    };
    return { total, active, byTier };
  }, [publishers]);

  // ── SortIcon helper ───────────────────────────────────────────────────────

  function SortIcon({ field }: { field: keyof Publisher }) {
    if (sortKey !== field)
      return (
        <ChevronDown className="ml-1 inline h-3.5 w-3.5 opacity-30" />
      );
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5 text-blue-600" />
    );
  }

  // ── No company setup ──────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publisher CRM</h1>
        </div>
        <div className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50">
          <div className="text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-amber-400" />
            <p className="font-medium text-amber-800">Chưa cấu hình công ty</p>
            <p className="mt-1 text-sm text-amber-600">
              Vui lòng thiết lập thông tin công ty trong mục Cài đặt trước khi
              sử dụng Publisher CRM.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publisher CRM</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý danh sách publisher và nhật ký liên lạc
          </p>
        </div>
        <Button onClick={handleAdd} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Thêm Publisher
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Tổng" value={stats.total} className="col-span-1" />
        <StatCard
          label="Đang hoạt động"
          value={stats.active}
          className="col-span-1 text-green-700"
        />
        <StatCard
          label="Platinum"
          value={stats.byTier.Platinum}
          className="col-span-1 text-violet-700"
        />
        <StatCard
          label="Gold"
          value={stats.byTier.Gold}
          className="col-span-1 text-amber-700"
        />
        <StatCard
          label="Silver"
          value={stats.byTier.Silver}
          className="col-span-1 text-slate-700"
        />
        <StatCard
          label="Bronze"
          value={stats.byTier.Bronze}
          className="col-span-1 text-orange-700"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tier filter tabs */}
          <Tabs
            value={tierFilter}
            onValueChange={(v) => setTierFilter(v as TierFilter)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-2.5">
                Tất cả
              </TabsTrigger>
              <TabsTrigger value="Platinum" className="text-xs px-2.5">
                <span className="h-2 w-2 rounded-full bg-violet-500 mr-1" />
                Platinum
              </TabsTrigger>
              <TabsTrigger value="Gold" className="text-xs px-2.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 mr-1" />
                Gold
              </TabsTrigger>
              <TabsTrigger value="Silver" className="text-xs px-2.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 mr-1" />
                Silver
              </TabsTrigger>
              <TabsTrigger value="Bronze" className="text-xs px-2.5">
                <span className="h-2 w-2 rounded-full bg-orange-500 mr-1" />
                Bronze
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Status filter */}
          <div className="flex rounded-md border border-input bg-muted p-1">
            {(
              [
                { value: "all", label: "Tất cả" },
                { value: "active", label: "Hoạt động" },
                { value: "inactive", label: "Dừng" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-all",
                  statusFilter === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead
                className="cursor-pointer select-none font-semibold text-gray-700"
                onClick={() => handleSort("name")}
              >
                Tên Publisher
                <SortIcon field="name" />
              </TableHead>
              <TableHead className="font-semibold text-gray-700">Email</TableHead>
              <TableHead
                className="cursor-pointer select-none font-semibold text-gray-700"
                onClick={() => handleSort("tier")}
              >
                Tier
                <SortIcon field="tier" />
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Traffic Sources
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Thanh toán
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Trạng thái
              </TableHead>
              <TableHead className="text-right font-semibold text-gray-700">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">
                      {searchQuery || tierFilter !== "all" || statusFilter !== "all"
                        ? "Không tìm thấy publisher nào phù hợp"
                        : "Chưa có publisher nào"}
                    </p>
                    {!searchQuery && tierFilter === "all" && statusFilter === "all" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAdd}
                        className="mt-1"
                      >
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Thêm Publisher đầu tiên
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((publisher) => (
                <TableRow
                  key={publisher.id}
                  className={cn(
                    "group",
                    !publisher.is_active && "opacity-60"
                  )}
                >
                  {/* Name */}
                  <TableCell>
                    <div className="font-medium text-gray-900">
                      {publisher.name}
                    </div>
                  </TableCell>

                  {/* Email */}
                  <TableCell>
                    {publisher.email ? (
                      <a
                        href={`mailto:${publisher.email}`}
                        className="text-sm text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {publisher.email}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Tier */}
                  <TableCell>
                    <TierBadge tier={publisher.tier} />
                  </TableCell>

                  {/* Traffic Sources */}
                  <TableCell>
                    {publisher.traffic_sources &&
                    publisher.traffic_sources.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {publisher.traffic_sources.map((src) => (
                          <span
                            key={src}
                            className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600"
                          >
                            {TRAFFIC_SOURCE_LABELS[src] ?? src}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Payment Method */}
                  <TableCell>
                    <span className="text-sm text-gray-700">
                      {publisher.payment_method || (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <StatusBadge isActive={publisher.is_active} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleView(publisher)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Chi tiết
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleEdit(publisher)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Sửa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Footer row count */}
        {filtered.length > 0 && (
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            Hiển thị {filtered.length} / {publishers.length} publisher
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <PublisherForm
        open={formOpen}
        onOpenChange={setFormOpen}
        publisher={editingPublisher}
        companyId={companyId}
        onSuccess={handleFormSuccess}
      />

      {/* Detail Dialog */}
      <PublisherDetail
        publisher={selectedPublisher}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(p) => {
          setDetailOpen(false);
          handleEdit(p);
        }}
      />
    </div>
  );
}

// ─── Stat card helper ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold", className)}>{value}</p>
    </div>
  );
}
