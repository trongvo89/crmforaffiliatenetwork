"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Plus,
  Search,
  Building2,
  Loader2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdvertiserForm, type Advertiser } from "./components/advertiser-form";
import { OffersTable } from "./components/offers-table";
import { type Offer } from "./components/offer-form";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdvertisersClientProps {
  initialAdvertisers: Advertiser[];
  initialOffers: Offer[];
  companyId: string;
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterMode = "active" | "all";

// ─── Advertiser row ───────────────────────────────────────────────────────────

interface AdvertiserRowProps {
  advertiser: Advertiser;
  offers: Offer[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onToggleActive: () => Promise<void>;
  onOffersChange: (offers: Offer[]) => void;
  isToggling: boolean;
}

function AdvertiserRow({
  advertiser,
  offers,
  isExpanded,
  onToggleExpand,
  onEdit,
  onToggleActive,
  onOffersChange,
  isToggling,
}: AdvertiserRowProps) {
  const activeOffers = offers.filter((o) => o.status === "active").length;

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* ── Header row ── */}
      <div
        className={cn(
          "flex cursor-pointer items-center gap-3 px-4 py-3 select-none",
          isExpanded && "border-b bg-gray-50/60"
        )}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggleExpand()}
        aria-expanded={isExpanded}
      >
        {/* Expand chevron */}
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        {/* Avatar / icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Building2 className="h-4 w-4" />
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{advertiser.name}</span>
            {advertiser.is_active ? (
              <Badge variant="success">Hoạt động</Badge>
            ) : (
              <Badge variant="secondary" className="border-transparent bg-slate-100 text-slate-500">
                Ngừng hoạt động
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {advertiser.contact_name && <span>{advertiser.contact_name}</span>}
            {advertiser.contact_email && <span>{advertiser.contact_email}</span>}
            <span>NET {advertiser.payment_terms} ngày</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activeOffers} offer đang chạy
            </span>
          </div>
        </div>

        {/* Actions — stop propagation so clicks don't toggle accordion */}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onEdit}
            title="Chỉnh sửa advertiser"
            disabled={isToggling}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-8 w-8",
              advertiser.is_active
                ? "text-green-600 hover:bg-green-50 hover:text-green-700"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
            onClick={onToggleActive}
            title={advertiser.is_active ? "Vô hiệu hoá" : "Kích hoạt"}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : advertiser.is_active ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Expanded: notes + offers ── */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Notes */}
          {advertiser.notes && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-100">
              <span className="font-medium">Ghi chú:</span> {advertiser.notes}
            </p>
          )}

          {/* Offers table */}
          <OffersTable
            advertiserId={advertiser.id}
            advertiserName={advertiser.name}
            offers={offers}
            onOffersChange={onOffersChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdvertisersClient({
  initialAdvertisers,
  initialOffers,
  companyId,
}: AdvertisersClientProps) {
  const { toast } = useToast();

  // ── state ──────────────────────────────────────────────────────────────────
  const [advertisers, setAdvertisers] = React.useState<Advertiser[]>(initialAdvertisers);
  const [offersMap, setOffersMap] = React.useState<Record<string, Offer[]>>(() => {
    const map: Record<string, Offer[]> = {};
    initialAdvertisers.forEach((adv) => {
      map[adv.id] = initialOffers.filter((o) => o.advertiser_id === adv.id);
    });
    return map;
  });

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const [filterMode, setFilterMode] = React.useState<FilterMode>("active");

  // form dialog
  const [advertiserFormOpen, setAdvertiserFormOpen] = React.useState(false);
  const [editingAdvertiser, setEditingAdvertiser] = React.useState<Advertiser | null>(null);

  // per-row loading state for toggle active
  const [togglingIds, setTogglingIds] = React.useState<Set<string>>(new Set());

  // ── derived: filtered list ─────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = advertisers;
    if (filterMode === "active") {
      list = list.filter((a) => a.is_active);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.contact_name ?? "").toLowerCase().includes(q) ||
          (a.contact_email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [advertisers, filterMode, search]);

  // ── handlers ───────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleAddAdvertiser() {
    setEditingAdvertiser(null);
    setAdvertiserFormOpen(true);
  }

  function handleEditAdvertiser(adv: Advertiser) {
    setEditingAdvertiser(adv);
    setAdvertiserFormOpen(true);
  }

  function handleAdvertiserSaved(saved: Advertiser) {
    const exists = advertisers.find((a) => a.id === saved.id);
    if (exists) {
      setAdvertisers((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    } else {
      setAdvertisers((prev) => [saved, ...prev]);
      setOffersMap((prev) => ({ ...prev, [saved.id]: [] }));
      // Auto-expand newly added advertiser
      setExpandedIds((prev) => { const next = new Set(prev); next.add(saved.id); return next; });
    }
  }

  async function handleToggleActive(adv: Advertiser) {
    setTogglingIds((prev) => { const next = new Set(prev); next.add(adv.id); return next; });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("advertisers")
        .update({ is_active: !adv.is_active, updated_at: new Date().toISOString() })
        .eq("id", adv.id)
        .select()
        .single();

      if (error) throw error;
      setAdvertisers((prev) =>
        prev.map((a) => (a.id === adv.id ? (data as Advertiser) : a))
      );
      toast({
        title: !adv.is_active ? "Advertiser đã được kích hoạt" : "Advertiser đã bị vô hiệu hoá",
        description: `"${adv.name}"`,
      });
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(adv.id);
        return next;
      });
    }
  }

  function handleOffersChange(advertiserId: string, offers: Offer[]) {
    setOffersMap((prev) => ({ ...prev, [advertiserId]: offers }));
  }

  // ── counts for filter tabs ─────────────────────────────────────────────────
  const activeCount = advertisers.filter((a) => a.is_active).length;
  const totalCount = advertisers.length;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advertiser &amp; Offer</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý advertiser và offer của mạng lưới affiliate
          </p>
        </div>
        <Button onClick={handleAddAdvertiser} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Thêm Advertiser
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm kiếm theo tên, liên hệ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-lg border bg-white p-0.5 gap-0.5 shrink-0">
          <button
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filterMode === "active"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setFilterMode("active")}
          >
            Đang hoạt động
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {activeCount}
            </span>
          </button>
          <button
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filterMode === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setFilterMode("all")}
          >
            Tất cả
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {totalCount}
            </span>
          </button>
        </div>
      </div>

      {/* Advertiser list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Building2 className="h-12 w-12 text-gray-200" />
          {advertisers.length === 0 ? (
            <>
              <p className="font-medium text-gray-600">Chưa có advertiser nào</p>
              <p className="text-sm text-muted-foreground">
                Bắt đầu bằng cách thêm advertiser đầu tiên
              </p>
              <Button onClick={handleAddAdvertiser} className="gap-2 mt-2">
                <Plus className="h-4 w-4" />
                Thêm Advertiser
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-600">Không tìm thấy advertiser nào</p>
              <p className="text-sm text-muted-foreground">
                Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((adv) => (
            <AdvertiserRow
              key={adv.id}
              advertiser={adv}
              offers={offersMap[adv.id] ?? []}
              isExpanded={expandedIds.has(adv.id)}
              onToggleExpand={() => toggleExpand(adv.id)}
              onEdit={() => handleEditAdvertiser(adv)}
              onToggleActive={() => handleToggleActive(adv)}
              onOffersChange={(offers) => handleOffersChange(adv.id, offers)}
              isToggling={togglingIds.has(adv.id)}
            />
          ))}
        </div>
      )}

      {/* Advertiser form dialog */}
      <AdvertiserForm
        open={advertiserFormOpen}
        onOpenChange={setAdvertiserFormOpen}
        advertiser={editingAdvertiser}
        companyId={companyId}
        onSaved={handleAdvertiserSaved}
      />
    </div>
  );
}
