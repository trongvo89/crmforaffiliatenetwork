"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
  Plus,
  PackageOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Offer, type OfferStatus, OfferForm } from "./offer-form";

// ─── Budget helpers ───────────────────────────────────────────────────────────

function formatVND(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}M`;
  }
  return value.toLocaleString("vi-VN");
}

function BudgetCell({ offer }: { offer: Offer }) {
  if (offer.budget_total == null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const pct = offer.budget_total > 0 ? (offer.budget_spent / offer.budget_total) * 100 : 0;
  const clampedPct = Math.min(pct, 100);

  const barColor =
    pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-400" : "bg-green-500";

  return (
    <div className="min-w-[130px] space-y-1">
      <div className="flex items-center gap-1 text-xs">
        <span>
          {formatVND(offer.budget_spent)} / {formatVND(offer.budget_total)}
        </span>
        <span className="text-muted-foreground">({clampedPct.toFixed(0)}%)</span>
        {pct > 80 && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-label="Budget vượt 80%" />
        )}
      </div>
      {/* custom progress bar so we control colour */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Model badge colours ──────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  CPA: "bg-blue-100 text-blue-800",
  CPL: "bg-violet-100 text-violet-800",
  CPS: "bg-cyan-100 text-cyan-800",
  CPI: "bg-pink-100 text-pink-800",
  RevShare: "bg-orange-100 text-orange-800",
};

function ModelBadge({ model }: { model: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        MODEL_COLORS[model] ?? "bg-gray-100 text-gray-800"
      )}
    >
      {model}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OfferStatus }) {
  if (status === "active") return <Badge variant="success">Đang chạy</Badge>;
  if (status === "paused") return <Badge variant="warning">Tạm dừng</Badge>;
  return <Badge variant="secondary" className="border-transparent bg-slate-100 text-slate-600">Kết thúc</Badge>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OffersTableProps {
  advertiserId: string;
  advertiserName: string;
  offers: Offer[];
  onOffersChange: (offers: Offer[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OffersTable({
  advertiserId,
  advertiserName,
  offers,
  onOffersChange,
}: OffersTableProps) {
  const { toast } = useToast();

  const [offerFormOpen, setOfferFormOpen] = React.useState(false);
  const [editingOffer, setEditingOffer] = React.useState<Offer | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  // ── open add form ──────────────────────────────────────────────────────────
  function handleAddOffer() {
    setEditingOffer(null);
    setOfferFormOpen(true);
  }

  // ── open edit form ─────────────────────────────────────────────────────────
  function handleEditOffer(offer: Offer) {
    setEditingOffer(offer);
    setOfferFormOpen(true);
  }

  // ── callback when form saves ───────────────────────────────────────────────
  function handleOfferSaved(saved: Offer) {
    const exists = offers.find((o) => o.id === saved.id);
    if (exists) {
      onOffersChange(offers.map((o) => (o.id === saved.id ? saved : o)));
    } else {
      onOffersChange([...offers, saved]);
    }
  }

  // ── toggle status active ↔ paused ─────────────────────────────────────────
  async function handleToggleStatus(offer: Offer) {
    if (offer.status === "ended") return; // ended cannot be toggled
    const nextStatus: OfferStatus = offer.status === "active" ? "paused" : "active";
    setLoadingId(offer.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("offers")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", offer.id)
        .select()
        .single();

      if (error) throw error;
      onOffersChange(offers.map((o) => (o.id === offer.id ? (data as Offer) : o)));
      toast({
        title: nextStatus === "active" ? "Offer đã được kích hoạt" : "Offer đã tạm dừng",
        description: `"${offer.name}" → ${nextStatus === "active" ? "Đang chạy" : "Tạm dừng"}`,
      });
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  }

  // ── delete (only if ended) ─────────────────────────────────────────────────
  async function handleDeleteOffer(offer: Offer) {
    if (offer.status !== "ended") return;
    const confirmed = window.confirm(
      `Xóa offer "${offer.name}"? Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setLoadingId(offer.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("offers").delete().eq("id", offer.id);
      if (error) throw error;
      onOffersChange(offers.filter((o) => o.id !== offer.id));
      toast({ title: "Đã xóa offer", description: `"${offer.name}" đã được xóa.` });
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Offers sub-header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {offers.length} offer{offers.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" variant="outline" onClick={handleAddOffer} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Thêm Offer
        </Button>
      </div>

      {/* Empty state */}
      {offers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
          <PackageOpen className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-muted-foreground">Chưa có offer nào.</p>
          <Button size="sm" variant="outline" onClick={handleAddOffer} className="gap-1.5 mt-1">
            <Plus className="h-3.5 w-3.5" />
            Thêm Offer đầu tiên
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="py-2.5 text-xs">Tên offer</TableHead>
                <TableHead className="py-2.5 text-xs">Model</TableHead>
                <TableHead className="py-2.5 text-xs">Payout</TableHead>
                <TableHead className="py-2.5 text-xs">Geo</TableHead>
                <TableHead className="py-2.5 text-xs">Budget / Đã dùng</TableHead>
                <TableHead className="py-2.5 text-xs">Trạng thái</TableHead>
                <TableHead className="py-2.5 text-xs text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => {
                const isLoading = loadingId === offer.id;
                return (
                  <TableRow key={offer.id} className="text-sm">
                    {/* Name */}
                    <TableCell className="py-2.5 font-medium">{offer.name}</TableCell>

                    {/* Model */}
                    <TableCell className="py-2.5">
                      <ModelBadge model={offer.model} />
                    </TableCell>

                    {/* Payout */}
                    <TableCell className="py-2.5 font-mono text-xs">
                      {offer.payout.toLocaleString("vi-VN")}
                      <span className="ml-0.5 text-muted-foreground">₫</span>
                    </TableCell>

                    {/* Geo */}
                    <TableCell className="py-2.5">
                      {offer.geo && offer.geo.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {offer.geo.map((g) => (
                            <span
                              key={g}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Budget */}
                    <TableCell className="py-2.5">
                      <BudgetCell offer={offer} />
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <StatusBadge status={offer.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleEditOffer(offer)}
                          disabled={isLoading}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        {/* Toggle active/paused (not available for ended) */}
                        {offer.status !== "ended" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleToggleStatus(offer)}
                            disabled={isLoading}
                            title={offer.status === "active" ? "Tạm dừng" : "Kích hoạt"}
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : offer.status === "active" ? (
                              <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <PlayCircle className="h-3.5 w-3.5 text-green-600" />
                            )}
                          </Button>
                        )}

                        {/* Delete — only for ended offers */}
                        {offer.status === "ended" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDeleteOffer(offer)}
                            disabled={isLoading}
                            title="Xóa offer"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Offer form dialog */}
      <OfferForm
        open={offerFormOpen}
        onOpenChange={setOfferFormOpen}
        offer={editingOffer}
        advertiserId={advertiserId}
        advertiserName={advertiserName}
        onSaved={handleOfferSaved}
      />
    </div>
  );
}
