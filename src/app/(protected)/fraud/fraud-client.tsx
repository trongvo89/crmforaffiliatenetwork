"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ShieldAlert,
  Search,
  Plus,
  Loader2,
  Flag,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  TrendingUp,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FraudFlag {
  id: string;
  company_id: string;
  publisher_id: string | null;
  campaign_id: string | null;
  flag_type: "cr_spike" | "fraud_rate" | "revenue_anomaly";
  severity: "high" | "medium" | "low";
  status: "new" | "investigating" | "cleared" | "blocked";
  details: Record<string, unknown> | string | null;
  created_at: string;
  publishers?: { id: string; name: string; tier: string } | null;
}

interface Publisher {
  id: string;
  name: string;
  tier: string;
}

interface DailyMetric {
  id: string;
  publisher_id: string | null;
  date: string;
  clicks: number;
  conversions: number;
  revenue: number;
  cr: number;
  publishers?: { id: string; name: string; tier: string } | null;
}

interface Company {
  id: string;
  name: string;
  fraud_platinum_threshold: number | null;
  fraud_gold_threshold: number | null;
  fraud_silver_threshold: number | null;
  fraud_bronze_threshold: number | null;
}

interface FraudClientProps {
  initialFlags: FraudFlag[];
  publishers: Publisher[];
  recentMetrics: DailyMetric[];
  companyId: string;
  company: Company;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FLAG_TYPE_LABELS: Record<FraudFlag["flag_type"], string> = {
  cr_spike: "CR đột biến",
  fraud_rate: "Tỷ lệ gian lận",
  revenue_anomaly: "Doanh thu bất thường",
};

const SEVERITY_LABELS: Record<FraudFlag["severity"], string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const STATUS_LABELS: Record<FraudFlag["status"], string> = {
  new: "Mới",
  investigating: "Đang điều tra",
  cleared: "Đã xóa",
  blocked: "Đã chặn",
};

const TIER_DEFAULT_THRESHOLDS: Record<string, number> = {
  platinum: 50,
  gold: 40,
  silver: 30,
  bronze: 20,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverityClasses(severity: FraudFlag["severity"]): string {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-orange-100 text-orange-700";
    case "low":
      return "bg-yellow-100 text-yellow-700";
  }
}

function getSeverityDotClass(severity: FraudFlag["severity"]): string {
  switch (severity) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-orange-500";
    case "low":
      return "bg-yellow-500";
  }
}

function getStatusClasses(status: FraudFlag["status"]): string {
  switch (status) {
    case "new":
      return "bg-red-100 text-red-700";
    case "investigating":
      return "bg-orange-100 text-orange-700";
    case "cleared":
      return "bg-green-100 text-green-700";
    case "blocked":
      return "bg-gray-100 text-gray-600";
  }
}

function getTierBadgeClass(tier: string): string {
  switch (tier.toLowerCase()) {
    case "platinum":
      return "bg-purple-100 text-purple-700";
    case "gold":
      return "bg-yellow-100 text-yellow-700";
    case "silver":
      return "bg-gray-200 text-gray-700";
    case "bronze":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function getThresholdForTier(tier: string, company: Company): number {
  const t = tier.toLowerCase();
  if (t === "platinum")
    return company.fraud_platinum_threshold ?? TIER_DEFAULT_THRESHOLDS.platinum;
  if (t === "gold")
    return company.fraud_gold_threshold ?? TIER_DEFAULT_THRESHOLDS.gold;
  if (t === "silver")
    return company.fraud_silver_threshold ?? TIER_DEFAULT_THRESHOLDS.silver;
  if (t === "bronze")
    return company.fraud_bronze_threshold ?? TIER_DEFAULT_THRESHOLDS.bronze;
  return 20;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: FraudFlag["severity"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getSeverityClasses(severity)}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${getSeverityDotClass(severity)}`}
      />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function StatusBadge({ status }: { status: FraudFlag["status"] }) {
  const icons: Record<FraudFlag["status"], React.ReactNode> = {
    new: <AlertTriangle className="h-3 w-3" />,
    investigating: <Clock className="h-3 w-3" />,
    cleared: <CheckCircle2 className="h-3 w-3" />,
    blocked: <Ban className="h-3 w-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(status)}`}
    >
      {icons[status]}
      {STATUS_LABELS[status]}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${getTierBadgeClass(tier)}`}
    >
      {tier}
    </span>
  );
}

function DetailsPreview({ details }: { details: Record<string, unknown> | string | null }) {
  if (!details) return null;
  if (typeof details === "string") {
    return <p className="text-xs text-gray-500 line-clamp-2">{details}</p>;
  }
  const parts: string[] = [];
  if (details.note) parts.push(details.note);
  if (details.date) parts.push(`Ngày: ${details.date}`);
  if (details.cr !== undefined)
    parts.push(`CR: ${Number(details.cr).toFixed(2)}%`);
  if (details.threshold !== undefined)
    parts.push(`Ngưỡng: ${details.threshold}%`);
  if (details.publisher_name) parts.push(`Publisher: ${details.publisher_name}`);
  if (parts.length === 0) {
    try {
      return (
        <p className="text-xs text-gray-500 line-clamp-2">
          {JSON.stringify(details)}
        </p>
      );
    } catch {
      return null;
    }
  }
  return <p className="text-xs text-gray-500 line-clamp-2">{parts.join(" · ")}</p>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  colorClass,
  icon,
}: {
  label: string;
  count: number;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{count}</p>
      </div>
    </div>
  );
}

// ─── Manual Flag Form ─────────────────────────────────────────────────────────

interface ManualFlagFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishers: Publisher[];
  companyId: string;
  onCreated: (flag: FraudFlag) => void;
}

function ManualFlagForm({
  open,
  onOpenChange,
  publishers,
  companyId,
  onCreated,
}: ManualFlagFormProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const [publisherId, setPublisherId] = React.useState("");
  const [flagType, setFlagType] =
    React.useState<FraudFlag["flag_type"]>("cr_spike");
  const [severity, setSeverity] =
    React.useState<FraudFlag["severity"]>("medium");
  const [detailsNote, setDetailsNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function resetForm() {
    setPublisherId("");
    setFlagType("cr_spike");
    setSeverity("medium");
    setDetailsNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publisherId) {
      toast({
        title: "Vui lòng chọn publisher",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("fraud_flags")
        .insert({
          company_id: companyId,
          publisher_id: publisherId,
          campaign_id: null,
          flag_type: flagType,
          severity,
          status: "new",
          details: { note: detailsNote },
        })
        .select("*, publishers(id, name, tier)")
        .single();

      if (error) throw error;

      onCreated(data as FraudFlag);
      toast({ title: "Đã tạo cờ gian lận thủ công" });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        title: "Tạo cờ thất bại",
        description: "Có lỗi xảy ra khi tạo cờ gian lận.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo cờ gian lận thủ công</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Publisher */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-publisher">
              Publisher <span className="text-red-500">*</span>
            </Label>
            <Select value={publisherId} onValueChange={setPublisherId}>
              <SelectTrigger id="manual-publisher">
                <SelectValue placeholder="Chọn publisher..." />
              </SelectTrigger>
              <SelectContent>
                {publishers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    <span className="ml-2 text-xs text-gray-400">
                      [{p.tier}]
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flag Type */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-flag-type">Loại cờ</Label>
            <Select
              value={flagType}
              onValueChange={(v) =>
                setFlagType(v as FraudFlag["flag_type"])
              }
            >
              <SelectTrigger id="manual-flag-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cr_spike">CR đột biến</SelectItem>
                <SelectItem value="fraud_rate">Tỷ lệ gian lận</SelectItem>
                <SelectItem value="revenue_anomaly">
                  Doanh thu bất thường
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-severity">Mức độ nghiêm trọng</Label>
            <Select
              value={severity}
              onValueChange={(v) =>
                setSeverity(v as FraudFlag["severity"])
              }
            >
              <SelectTrigger id="manual-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Cao</SelectItem>
                <SelectItem value="medium">Trung bình</SelectItem>
                <SelectItem value="low">Thấp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-note">Ghi chú chi tiết</Label>
            <Textarea
              id="manual-note"
              placeholder="Mô tả lý do tạo cờ..."
              value={detailsNote}
              onChange={(e) => setDetailsNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Flag className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? "Đang tạo..." : "Tạo cờ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FraudClient({
  initialFlags,
  publishers,
  recentMetrics,
  companyId,
  company,
}: FraudClientProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const [flags, setFlags] = React.useState<FraudFlag[]>(initialFlags);
  const [filterSeverity, setFilterSeverity] = React.useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [filterStatus, setFilterStatus] = React.useState<
    "all" | "new" | "investigating" | "cleared" | "blocked"
  >("all");
  const [showFlagForm, setShowFlagForm] = React.useState(false);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  // ── Status counts ──────────────────────────────────────────────────────────

  const counts = React.useMemo(() => {
    return flags.reduce(
      (acc, f) => {
        acc[f.status] = (acc[f.status] ?? 0) + 1;
        return acc;
      },
      { new: 0, investigating: 0, cleared: 0, blocked: 0 } as Record<
        FraudFlag["status"],
        number
      >
    );
  }, [flags]);

  // ── Filtered flags ─────────────────────────────────────────────────────────

  const filteredFlags = React.useMemo(() => {
    return flags.filter((f) => {
      if (filterSeverity !== "all" && f.severity !== filterSeverity)
        return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      return true;
    });
  }, [flags, filterSeverity, filterStatus]);

  // ── Auto-detect ────────────────────────────────────────────────────────────

  async function runAutoDetect() {
    setIsDetecting(true);
    try {
      // Group recentMetrics by publisher_id
      const byPublisher = new Map<string, DailyMetric[]>();
      for (const metric of recentMetrics) {
        if (!metric.publisher_id) continue;
        const existing = byPublisher.get(metric.publisher_id) ?? [];
        existing.push(metric);
        byPublisher.set(metric.publisher_id, existing);
      }

      // Find the publisher map for tier lookup
      const publisherMap = new Map<string, Publisher>();
      for (const p of publishers) {
        publisherMap.set(p.id, p);
      }

      // Also grab tier from metric.publishers in case not in publishers list
      const tierFromMetric = new Map<string, string>();
      for (const metric of recentMetrics) {
        if (metric.publisher_id && metric.publishers?.tier) {
          tierFromMetric.set(metric.publisher_id, metric.publishers.tier);
        }
      }

      const flagsToInsert: {
        company_id: string;
        publisher_id: string;
        campaign_id: null;
        flag_type: "cr_spike";
        severity: FraudFlag["severity"];
        status: "new";
        details: object;
      }[] = [];

      for (const [publisherId, metrics] of Array.from(byPublisher.entries())) {
        const pub = publisherMap.get(publisherId);
        const tier =
          pub?.tier ?? tierFromMetric.get(publisherId) ?? "bronze";
        const threshold = getThresholdForTier(tier, company);
        const publisherName =
          pub?.name ??
          metrics[0].publishers?.name ??
          "Unknown";

        for (const metric of metrics) {
          const cr = metric.cr ?? 0;
          if (cr > threshold) {
            const severity: FraudFlag["severity"] =
              cr > threshold * 2
                ? "high"
                : cr > threshold * 1.5
                  ? "medium"
                  : "low";

            flagsToInsert.push({
              company_id: companyId,
              publisher_id: publisherId,
              campaign_id: null,
              flag_type: "cr_spike",
              severity,
              status: "new",
              details: {
                date: metric.date,
                cr,
                threshold,
                publisher_name: publisherName,
              },
            });
          }
        }
      }

      if (flagsToInsert.length === 0) {
        toast({
          title: "Không phát hiện bất thường",
          description: "Tất cả các chỉ số CR nằm trong ngưỡng cho phép.",
        });
        return;
      }

      const { data: inserted, error } = await supabase
        .from("fraud_flags")
        .insert(flagsToInsert)
        .select("*, publishers(id, name, tier)");

      if (error) throw error;

      const newFlags = (inserted ?? []) as FraudFlag[];
      setFlags((prev) => [...newFlags, ...prev]);
      toast({
        title: `Đã tạo ${newFlags.length} cờ mới từ phân tích tự động`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Phát hiện thất bại",
        description: "Có lỗi xảy ra trong quá trình phân tích tự động.",
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  }

  // ── Status update ──────────────────────────────────────────────────────────

  async function updateFlagStatus(flagId: string, newStatus: string) {
    setUpdatingId(flagId);
    try {
      const { error } = await supabase
        .from("fraud_flags")
        .update({ status: newStatus })
        .eq("id", flagId);

      if (error) throw error;

      setFlags((prev) =>
        prev.map((f) =>
          f.id === flagId ? { ...f, status: newStatus as FraudFlag["status"] } : f
        )
      );

      const statusLabel = STATUS_LABELS[newStatus as FraudFlag["status"]] ?? newStatus;
      toast({ title: `Trạng thái đã cập nhật: ${statusLabel}` });
    } catch (err) {
      console.error(err);
      toast({
        title: "Cập nhật thất bại",
        description: "Có lỗi xảy ra khi cập nhật trạng thái.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Phát hiện Gian lận
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi và xử lý các hành vi bất thường từ publisher
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={runAutoDetect}
            disabled={isDetecting}
          >
            {isDetecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {isDetecting ? "Đang phân tích..." : "Tự động phát hiện"}
          </Button>
          <Button onClick={() => setShowFlagForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo cờ thủ công
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Mới"
          count={counts.new}
          colorClass="bg-red-100 text-red-600"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Đang điều tra"
          count={counts.investigating}
          colorClass="bg-orange-100 text-orange-600"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="Đã xóa"
          count={counts.cleared}
          colorClass="bg-green-100 text-green-600"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Đã chặn"
          count={counts.blocked}
          colorClass="bg-gray-100 text-gray-500"
          icon={<Ban className="h-5 w-5" />}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-gray-600">Lọc theo:</span>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 whitespace-nowrap">
            Mức độ
          </Label>
          <Select
            value={filterSeverity}
            onValueChange={(v) =>
              setFilterSeverity(v as typeof filterSeverity)
            }
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="high">Cao</SelectItem>
              <SelectItem value="medium">Trung bình</SelectItem>
              <SelectItem value="low">Thấp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 whitespace-nowrap">
            Trạng thái
          </Label>
          <Select
            value={filterStatus}
            onValueChange={(v) =>
              setFilterStatus(v as typeof filterStatus)
            }
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="new">Mới</SelectItem>
              <SelectItem value="investigating">Đang điều tra</SelectItem>
              <SelectItem value="cleared">Đã xóa</SelectItem>
              <SelectItem value="blocked">Đã chặn</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(filterSeverity !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-gray-500"
            onClick={() => {
              setFilterSeverity("all");
              setFilterStatus("all");
            }}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Xóa bộ lọc
          </Button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filteredFlags.length} / {flags.length} cờ
        </span>
      </div>

      {/* Flag list */}
      {filteredFlags.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <ShieldAlert className="mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-500">
            {flags.length === 0
              ? "Chưa có cờ gian lận nào"
              : "Không có kết quả phù hợp bộ lọc"}
          </p>
          {flags.length === 0 && (
            <p className="mt-1 text-sm text-gray-400">
              Nhấn &quot;Tự động phát hiện&quot; để phân tích hoặc tạo cờ thủ công.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredFlags.map((flag) => {
            const isUpdating = updatingId === flag.id;

            return (
              <div
                key={flag.id}
                className="rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Card top row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: badges + title */}
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={flag.severity} />
                    <span className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      {FLAG_TYPE_LABELS[flag.flag_type]}
                    </span>
                    <StatusBadge status={flag.status} />
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {flag.status === "new" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        disabled={isUpdating}
                        onClick={() =>
                          updateFlagStatus(flag.id, "investigating")
                        }
                      >
                        {isUpdating ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="mr-1 h-3.5 w-3.5" />
                        )}
                        Điều tra
                      </Button>
                    )}

                    {flag.status === "investigating" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
                          disabled={isUpdating}
                          onClick={() =>
                            updateFlagStatus(flag.id, "cleared")
                          }
                        >
                          {isUpdating ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Xóa cờ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={isUpdating}
                          onClick={() =>
                            updateFlagStatus(flag.id, "blocked")
                          }
                        >
                          {isUpdating ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="mr-1 h-3.5 w-3.5" />
                          )}
                          Chặn Publisher
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Publisher info */}
                {flag.publishers && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {flag.publishers.name}
                    </span>
                    <TierBadge tier={flag.publishers.tier} />
                  </div>
                )}

                {/* Details + date */}
                <div className="mt-2 space-y-1">
                  <DetailsPreview details={flag.details} />
                  <p className="text-xs text-gray-400">
                    Tạo lúc: {formatDate(flag.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Flag Form Dialog */}
      <ManualFlagForm
        open={showFlagForm}
        onOpenChange={setShowFlagForm}
        publishers={publishers}
        companyId={companyId}
        onCreated={(flag) => setFlags((prev) => [flag, ...prev])}
      />
    </div>
  );
}
