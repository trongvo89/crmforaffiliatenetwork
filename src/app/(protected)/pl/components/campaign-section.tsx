"use client";

import React, { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

export interface Campaign {
  id: string;
  company_id: string;
  advertiser_id: string | null;
  offer_id: string | null;
  name: string;
  status: "active" | "paused" | "ended";
  advertisers?: { id: string; name: string } | null;
}

export interface CampaignPL {
  id: string;
  campaign_id: string;
  period_month: string;
  revenue: number;
  publisher_cost: number;
}

interface Advertiser {
  id: string;
  name: string;
}

interface Offer {
  id: string;
  name: string;
  advertiser_id: string;
  status: string;
}

interface CampaignSectionProps {
  companyId: string;
  campaigns: Campaign[];
  campaignPL: CampaignPL[];
  advertisers: Advertiser[];
  offers: Offer[];
  selectedMonth: string; // YYYY-MM
  onCampaignsChange: (campaigns: Campaign[]) => void;
  onCampaignPLChange: (cpl: CampaignPL[]) => void;
}

const STATUS_LABELS: Record<Campaign["status"], string> = {
  active: "Đang chạy",
  paused: "Tạm dừng",
  ended: "Đã kết thúc",
};

const STATUS_VARIANTS: Record<Campaign["status"], "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  ended: "danger",
};

const LOW_MARGIN_THRESHOLD = 15;

// ─── Campaign Form Dialog ────────────────────────────────────────────────────
interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  advertisers: Advertiser[];
  offers: Offer[];
  existing: Campaign | null;
  onSuccess: (campaign: Campaign) => void;
}

function CampaignFormDialog({
  open,
  onOpenChange,
  companyId,
  advertisers,
  offers,
  existing,
  onSuccess,
}: CampaignFormDialogProps) {
  const { toast } = useToast();
  const NONE = "__none__";
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [advertiserId, setAdvertiserId] = useState(NONE);
  const [offerId, setOfferId] = useState(NONE);
  const [status, setStatus] = useState<Campaign["status"]>("active");

  React.useEffect(() => {
    if (open) {
      if (existing) {
        setName(existing.name);
        setAdvertiserId(existing.advertiser_id ?? NONE);
        setOfferId(existing.offer_id ?? NONE);
        setStatus(existing.status);
      } else {
        setName("");
        setAdvertiserId(NONE);
        setOfferId(NONE);
        setStatus("active");
      }
    }
  }, [open, existing]);

  const filteredOffers = useMemo(
    () =>
      advertiserId !== NONE
        ? offers.filter((o) => o.advertiser_id === advertiserId)
        : offers,
    [offers, advertiserId]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên campaign", variant: "destructive" });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const payload = {
      company_id: companyId,
      name: name.trim(),
      advertiser_id: advertiserId !== NONE ? advertiserId : null,
      offer_id: offerId !== NONE ? offerId : null,
      status,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await supabase
        .from("crm_campaigns")
        .update(payload)
        .eq("id", existing.id)
        .select(`*, advertisers(id, name)`)
        .single();
    } else {
      result = await supabase
        .from("crm_campaigns")
        .insert(payload)
        .select(`*, advertisers(id, name)`)
        .single();
    }

    setLoading(false);

    if (result.error) {
      toast({
        title: "Lỗi",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: existing ? "Cập nhật thành công" : "Tạo campaign thành công",
      description: name.trim(),
    });
    onSuccess(result.data as Campaign);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Sửa Campaign" : "Thêm Campaign mới"}</DialogTitle>
          <DialogDescription>Quản lý thông tin campaign affiliate</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">Tên Campaign *</Label>
            <Input
              id="campaign-name"
              placeholder="Ví dụ: Shopee Q4 CPA"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="campaign-advertiser">Advertiser</Label>
            <Select
              value={advertiserId}
              onValueChange={(v) => {
                setAdvertiserId(v);
                setOfferId(NONE);
              }}
            >
              <SelectTrigger id="campaign-advertiser">
                <SelectValue placeholder="Chọn Advertiser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>-- Không chọn --</SelectItem>
                {advertisers.map((adv) => (
                  <SelectItem key={adv.id} value={adv.id}>
                    {adv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="campaign-offer">Offer</Label>
            <Select value={offerId} onValueChange={setOfferId}>
              <SelectTrigger id="campaign-offer">
                <SelectValue placeholder="Chọn Offer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>-- Không chọn --</SelectItem>
                {filteredOffers.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {offer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="campaign-status">Trạng thái</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Campaign["status"])}>
              <SelectTrigger id="campaign-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Đang chạy</SelectItem>
                <SelectItem value="paused">Tạm dừng</SelectItem>
                <SelectItem value="ended">Đã kết thúc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : existing ? "Cập nhật" : "Tạo Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaign P&L Inline Entry ───────────────────────────────────────────────
interface CampaignPLEntryProps {
  campaign: Campaign;
  selectedMonth: string;
  existingPL: CampaignPL | null;
  onSuccess: (cpl: CampaignPL) => void;
}

function CampaignPLEntry({ campaign, selectedMonth, existingPL, onSuccess }: CampaignPLEntryProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [revenue, setRevenue] = useState(existingPL ? String(existingPL.revenue) : "");
  const [publisherCost, setPublisherCost] = useState(
    existingPL ? String(existingPL.publisher_cost) : ""
  );

  React.useEffect(() => {
    setRevenue(existingPL ? String(existingPL.revenue) : "");
    setPublisherCost(existingPL ? String(existingPL.publisher_cost) : "");
  }, [existingPL, selectedMonth]);

  const rev = parseFloat(revenue) || 0;
  const cost = parseFloat(publisherCost) || 0;
  const grossProfit = rev - cost;
  const margin = rev > 0 ? (grossProfit / rev) * 100 : 0;

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const periodMonth = `${selectedMonth}-01`;

    const payload = {
      campaign_id: campaign.id,
      period_month: periodMonth,
      revenue: rev,
      publisher_cost: cost,
      updated_at: new Date().toISOString(),
    };

    const result = await supabase
      .from("campaign_pl")
      .upsert(payload, { onConflict: "campaign_id,period_month" })
      .select()
      .single();

    setLoading(false);

    if (result.error) {
      toast({ title: "Lỗi", description: result.error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Đã lưu", description: `P&L campaign ${campaign.name}` });
    onSuccess(result.data as CampaignPL);
  }

  return (
    <div className="mt-3 rounded-md bg-gray-50 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Nhập P&L cho tháng {selectedMonth.split("-")[1]}/{selectedMonth.split("-")[0]}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label className="text-xs">Doanh thu (M)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            className="h-8 w-28 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Chi phí Publisher (M)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={publisherCost}
            onChange={(e) => setPublisherCost(e.target.value)}
            className="h-8 w-28 text-sm"
          />
        </div>
        {rev > 0 && (
          <div className="text-xs space-y-0.5 pb-1">
            <p className="text-muted-foreground">
              Gross Profit:{" "}
              <span className={cn("font-medium", grossProfit >= 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(grossProfit)}
              </span>
            </p>
            <p className={cn("font-medium", margin < LOW_MARGIN_THRESHOLD ? "text-red-600" : "text-green-600")}>
              Margin: {formatPercent(margin)}
              {margin < LOW_MARGIN_THRESHOLD && " ⚠"}
            </p>
          </div>
        )}
        <Button size="sm" onClick={handleSave} disabled={loading} className="h-8">
          {loading ? "Lưu..." : "Lưu"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Campaign Section ───────────────────────────────────────────────────
export function CampaignSection({
  companyId,
  campaigns,
  campaignPL,
  advertisers,
  offers,
  selectedMonth,
  onCampaignsChange,
  onCampaignPLChange,
}: CampaignSectionProps) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Low margin alert campaigns for current month
  const lowMarginCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const pl = campaignPL.find(
        (p) => p.campaign_id === c.id && p.period_month.startsWith(selectedMonth)
      );
      if (!pl || pl.revenue === 0) return false;
      const margin = ((pl.revenue - pl.publisher_cost) / pl.revenue) * 100;
      return margin < LOW_MARGIN_THRESHOLD;
    });
  }, [campaigns, campaignPL, selectedMonth]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCampaignSuccess(campaign: Campaign) {
    const exists = campaigns.find((c) => c.id === campaign.id);
    if (exists) {
      onCampaignsChange(campaigns.map((c) => (c.id === campaign.id ? campaign : c)));
    } else {
      onCampaignsChange([campaign, ...campaigns]);
    }
  }

  function handlePLSuccess(cpl: CampaignPL) {
    const exists = campaignPL.find((p) => p.id === cpl.id);
    if (exists) {
      onCampaignPLChange(campaignPL.map((p) => (p.id === cpl.id ? cpl : p)));
    } else {
      // Check by campaign_id + period_month (upsert may return updated)
      const byKey = campaignPL.find(
        (p) => p.campaign_id === cpl.campaign_id && p.period_month === cpl.period_month
      );
      if (byKey) {
        onCampaignPLChange(
          campaignPL.map((p) =>
            p.campaign_id === cpl.campaign_id && p.period_month === cpl.period_month ? cpl : p
          )
        );
      } else {
        onCampaignPLChange([...campaignPL, cpl]);
      }
    }
  }

  async function handleDelete(campaign: Campaign) {
    if (!confirm(`Xóa campaign "${campaign.name}"? Dữ liệu P&L liên quan cũng sẽ bị xóa.`)) return;
    setDeletingId(campaign.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("crm_campaigns")
      .delete()
      .eq("id", campaign.id)
      .eq("company_id", companyId);
    setDeletingId(null);

    if (error) {
      toast({ title: "Lỗi xóa", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xóa campaign", description: campaign.name });
    onCampaignsChange(campaigns.filter((c) => c.id !== campaign.id));
    onCampaignPLChange(campaignPL.filter((p) => p.campaign_id !== campaign.id));
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Danh sách Campaign</h3>
          <p className="text-sm text-muted-foreground">
            Tháng {selectedMonth.split("-")[1]}/{selectedMonth.split("-")[0]} —{" "}
            {campaigns.length} campaign
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCampaign(null);
            setFormOpen(true);
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Thêm Campaign
        </Button>
      </div>

      {/* Low margin alert */}
      {lowMarginCampaigns.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Cảnh báo margin thấp (&lt;{LOW_MARGIN_THRESHOLD}%)</p>
            <p className="text-amber-700">
              {lowMarginCampaigns.map((c) => c.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Campaign table */}
      {campaigns.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-muted-foreground">Chưa có campaign nào</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingCampaign(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Thêm Campaign đầu tiên
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8"></TableHead>
                <TableHead>Tên Campaign</TableHead>
                <TableHead>Advertiser</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Chi phí PUB</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const pl = campaignPL.find(
                  (p) =>
                    p.campaign_id === campaign.id &&
                    p.period_month.startsWith(selectedMonth)
                );
                const rev = pl?.revenue ?? 0;
                const cost = pl?.publisher_cost ?? 0;
                const grossProfit = rev - cost;
                const margin = rev > 0 ? (grossProfit / rev) * 100 : null;
                const isLowMargin = margin !== null && margin < LOW_MARGIN_THRESHOLD;
                const isExpanded = expandedRows.has(campaign.id);

                return (
                  <React.Fragment key={campaign.id}>
                    <TableRow className={cn(isLowMargin && "bg-red-50/40")}>
                      <TableCell className="p-2">
                        <button
                          onClick={() => toggleRow(campaign.id)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          aria-label={isExpanded ? "Thu gọn" : "Mở rộng nhập P&L"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {campaign.name}
                          {isLowMargin && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {campaign.advertisers?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[campaign.status]}>
                          {STATUS_LABELS[campaign.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {rev > 0 ? formatCurrency(rev) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {cost > 0 ? formatCurrency(cost) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {margin !== null ? (
                          <span
                            className={cn(
                              "font-medium",
                              isLowMargin ? "text-red-600" : "text-green-600"
                            )}
                          >
                            {formatPercent(margin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingCampaign(campaign);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(campaign)}
                            disabled={deletingId === campaign.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="p-0 border-b-0">
                          <div className="px-4 pb-3">
                            <CampaignPLEntry
                              campaign={campaign}
                              selectedMonth={selectedMonth}
                              existingPL={pl ?? null}
                              onSuccess={handlePLSuccess}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Campaign Form Dialog */}
      <CampaignFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        advertisers={advertisers}
        offers={offers}
        existing={editingCampaign}
        onSuccess={handleCampaignSuccess}
      />
    </div>
  );
}
