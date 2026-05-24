"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyMetric {
  id: string;
  company_id: string;
  publisher_id: string | null;
  date: string;
  clicks: number;
  conversions: number;
  revenue: number;
  epc: number;
  cr: number;
  created_at: string;
  publishers?: { id: string; name: string; tier: string } | null;
}

interface Publisher {
  id: string;
  name: string;
  tier: string;
}

interface ApiConnection {
  id: string;
  company_id: string;
  name: string;
  type: "hasoffers" | "cake" | "custom";
  base_url: string;
  api_key: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface TrafficClientProps {
  initialMetrics: DailyMetric[];
  publishers: Publisher[];
  apiConnections: ApiConnection[];
  companyId: string;
  company: Company;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  Platinum: "bg-violet-100 text-violet-800",
  Gold: "bg-amber-100 text-amber-800",
  Silver: "bg-slate-100 text-slate-700",
  Bronze: "bg-orange-100 text-orange-800",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TIER_COLORS[tier] ?? "bg-gray-100 text-gray-700"
      )}
    >
      {tier}
    </span>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TrafficClient({
  initialMetrics,
  publishers: initialPublishers,
  apiConnections: initialConnections,
  companyId,
  company,
}: TrafficClientProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────

  const [metrics, setMetrics] = React.useState<DailyMetric[]>(initialMetrics);
  const [publishers] = React.useState<Publisher[]>(initialPublishers);
  const [apiConnections, setApiConnections] =
    React.useState<ApiConnection[]>(initialConnections);
  const [activeTab, setActiveTab] = React.useState<
    "dashboard" | "manual" | "upload" | "api"
  >("dashboard");

  // Manual form
  const [manualForm, setManualForm] = React.useState({
    publisher_id: "",
    date: today(),
    clicks: "",
    conversions: "",
    revenue: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // CSV upload
  const [csvRows, setCsvRows] = React.useState<Record<string, string>[]>([]);
  const [csvPreview, setCsvPreview] = React.useState(false);
  const [csvFileName, setCsvFileName] = React.useState("");
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    success: number;
    error: number;
  } | null>(null);

  // API connection form
  const [apiForm, setApiForm] = React.useState({
    name: "",
    type: "hasoffers" as "hasoffers" | "cake" | "custom",
    base_url: "",
    api_key: "",
  });
  const [isAddingConnection, setIsAddingConnection] = React.useState(false);
  const [showApiForm, setShowApiForm] = React.useState(false);

  // ── Computed values ────────────────────────────────────────────────────────

  const manualEpc =
    manualForm.clicks && parseFloat(manualForm.clicks) > 0
      ? (parseFloat(manualForm.revenue || "0") / parseFloat(manualForm.clicks)).toFixed(4)
      : "0";

  const manualCr =
    manualForm.clicks && parseFloat(manualForm.clicks) > 0
      ? (
          (parseFloat(manualForm.conversions || "0") /
            parseFloat(manualForm.clicks)) *
          100
        ).toFixed(2)
      : "0";

  // ── Dashboard computed ─────────────────────────────────────────────────────

  const totals = React.useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        clicks: acc.clicks + (m.clicks ?? 0),
        conversions: acc.conversions + (m.conversions ?? 0),
        revenue: acc.revenue + (m.revenue ?? 0),
      }),
      { clicks: 0, conversions: 0, revenue: 0 }
    );
  }, [metrics]);

  const avgCr = React.useMemo(() => {
    if (totals.clicks === 0) return 0;
    return (totals.conversions / totals.clicks) * 100;
  }, [totals]);

  // Chart data: group by date, sum per day
  const chartData = React.useMemo(() => {
    const map = new Map<
      string,
      { date: string; clicks: number; conversions: number; revenue: number }
    >();
    // Sort metrics by date ascending for chart
    const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
    for (const m of sorted) {
      const existing = map.get(m.date) ?? {
        date: m.date,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };
      map.set(m.date, {
        date: m.date,
        clicks: existing.clicks + (m.clicks ?? 0),
        conversions: existing.conversions + (m.conversions ?? 0),
        revenue: existing.revenue + (m.revenue ?? 0),
      });
    }
    return Array.from(map.values()).map((d) => ({
      ...d,
      dateLabel: formatDate(d.date),
    }));
  }, [metrics]);

  // Per-publisher aggregated stats
  const publisherStats = React.useMemo(() => {
    const map = new Map<
      string,
      {
        publisher_id: string;
        name: string;
        tier: string;
        clicks: number;
        conversions: number;
        revenue: number;
      }
    >();
    for (const m of metrics) {
      const pubId = m.publisher_id ?? "__none__";
      const pubName = m.publishers?.name ?? "Không xác định";
      const pubTier = m.publishers?.tier ?? "—";
      const existing = map.get(pubId) ?? {
        publisher_id: pubId,
        name: pubName,
        tier: pubTier,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };
      map.set(pubId, {
        ...existing,
        clicks: existing.clicks + (m.clicks ?? 0),
        conversions: existing.conversions + (m.conversions ?? 0),
        revenue: existing.revenue + (m.revenue ?? 0),
      });
    }
    return Array.from(map.values()).map((s) => ({
      ...s,
      cr: s.clicks > 0 ? (s.conversions / s.clicks) * 100 : 0,
      epc: s.clicks > 0 ? s.revenue / s.clicks : 0,
    }));
  }, [metrics]);

  // Anomaly detection: CR > 20% or revenue drop (simplified)
  const anomalies = React.useMemo(() => {
    const alerts: { publisher: string; message: string; severity: "warning" | "danger" }[] =
      [];
    for (const ps of publisherStats) {
      if (ps.cr > 20) {
        alerts.push({
          publisher: ps.name,
          message: `CR ${ps.cr.toFixed(1)}% — vượt ngưỡng 20%`,
          severity: "danger",
        });
      } else if (ps.cr > 15) {
        alerts.push({
          publisher: ps.name,
          message: `CR ${ps.cr.toFixed(1)}% — cần theo dõi`,
          severity: "warning",
        });
      }
    }
    // Revenue drop: compare last 7 days vs prior 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const last7Revenue = metrics
      .filter((m) => m.date >= sevenDaysAgo)
      .reduce((s, m) => s + (m.revenue ?? 0), 0);
    const prior7Revenue = metrics
      .filter((m) => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo)
      .reduce((s, m) => s + (m.revenue ?? 0), 0);
    if (prior7Revenue > 0 && last7Revenue < prior7Revenue * 0.75) {
      alerts.push({
        publisher: "Tổng hợp",
        message: `Doanh thu 7 ngày gần nhất giảm ${(((prior7Revenue - last7Revenue) / prior7Revenue) * 100).toFixed(1)}% so với 7 ngày trước`,
        severity: "warning",
      });
    }
    return alerts;
  }, [publisherStats, metrics]);

  // ── Manual form handlers ───────────────────────────────────────────────────

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.clicks || !manualForm.conversions || !manualForm.revenue) {
      toast({ title: "Lỗi", description: "Vui lòng nhập đầy đủ số liệu.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const clicks = parseFloat(manualForm.clicks);
    const conversions = parseFloat(manualForm.conversions);
    const revenue = parseFloat(manualForm.revenue);
    const epc = clicks > 0 ? revenue / clicks : 0;
    const cr = clicks > 0 ? (conversions / clicks) * 100 : 0;

    const payload = {
      company_id: companyId,
      publisher_id: manualForm.publisher_id || null,
      date: manualForm.date,
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
      revenue,
      epc,
      cr,
    };

    const { data, error } = await supabase
      .from("daily_metrics")
      .insert(payload)
      .select("*, publishers(id, name, tier)")
      .single();

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Thành công",
      description: `Đã lưu dữ liệu ngày ${manualForm.date}.`,
    });

    setMetrics((prev) => [data as DailyMetric, ...prev]);
    setManualForm({
      publisher_id: "",
      date: today(),
      clicks: "",
      conversions: "",
      revenue: "",
    });
  }

  // ── CSV upload handlers ────────────────────────────────────────────────────

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCsv(text);
    };
    reader.readAsText(file, "utf-8");
  }

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      toast({
        title: "File không hợp lệ",
        description: "File CSV phải có ít nhất 1 hàng dữ liệu và 1 hàng tiêu đề.",
        variant: "destructive",
      });
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });
      if (Object.values(row).some((v) => v !== "")) {
        rows.push(row);
      }
    }
    setCsvRows(rows);
    setCsvPreview(rows.length > 0);
  }

  async function handleCsvImport() {
    if (csvRows.length === 0) return;
    setIsImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of csvRows) {
      try {
        const publisherName = (row["publisher_name"] ?? row["publisher"] ?? "").trim();
        const publisher = publisherName
          ? publishers.find(
              (p) => p.name.toLowerCase() === publisherName.toLowerCase()
            )
          : null;

        const clicks = parseInt(row["clicks"] ?? "0", 10) || 0;
        const conversions = parseInt(row["conversions"] ?? "0", 10) || 0;
        const revenue = parseFloat(row["revenue"] ?? "0") || 0;
        const epc = clicks > 0 ? revenue / clicks : 0;
        const cr = clicks > 0 ? (conversions / clicks) * 100 : 0;
        const dateVal = (row["date"] ?? "").trim();

        if (!dateVal) {
          errors++;
          continue;
        }

        const { error } = await supabase.from("daily_metrics").insert({
          company_id: companyId,
          publisher_id: publisher?.id ?? null,
          date: dateVal,
          clicks,
          conversions,
          revenue,
          epc,
          cr,
        });

        if (error) {
          errors++;
        } else {
          success++;
        }
      } catch {
        errors++;
      }
    }

    setIsImporting(false);
    setImportResult({ success, error: errors });

    toast({
      title: "Hoàn tất import",
      description: `${success} hàng thành công, ${errors} hàng lỗi.`,
      variant: errors > 0 && success === 0 ? "destructive" : "default",
    });

    // Refresh metrics after successful imports
    if (success > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const { data } = await supabase
        .from("daily_metrics")
        .select("*, publishers(id, name, tier)")
        .eq("company_id", companyId)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: false });
      if (data) setMetrics(data as DailyMetric[]);
    }
  }

  // ── API connection handlers ────────────────────────────────────────────────

  async function handleAddConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!apiForm.name || !apiForm.base_url || !apiForm.api_key) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin kết nối.",
        variant: "destructive",
      });
      return;
    }
    setIsAddingConnection(true);

    const { data, error } = await supabase
      .from("api_connections")
      .insert({
        company_id: companyId,
        name: apiForm.name,
        type: apiForm.type,
        base_url: apiForm.base_url,
        api_key: apiForm.api_key,
        is_active: true,
      })
      .select("*")
      .single();

    setIsAddingConnection(false);

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Thành công",
      description: `Đã thêm kết nối "${apiForm.name}".`,
    });

    setApiConnections((prev) => [data as ApiConnection, ...prev]);
    setApiForm({ name: "", type: "hasoffers", base_url: "", api_key: "" });
    setShowApiForm(false);
  }

  async function handleDeleteConnection(id: string, name: string) {
    const { error } = await supabase
      .from("api_connections")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Đã xóa", description: `Đã xóa kết nối "${name}".` });
    setApiConnections((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleToggleConnection(conn: ApiConnection) {
    const { error } = await supabase
      .from("api_connections")
      .update({ is_active: !conn.is_active })
      .eq("id", conn.id);

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }

    setApiConnections((prev) =>
      prev.map((c) =>
        c.id === conn.id ? { ...c, is_active: !c.is_active } : c
      )
    );
  }

  function handleSyncConnection(name: string) {
    toast({
      title: `Sync "${name}"`,
      description:
        "Tính năng kết nối API đang được phát triển. Vui lòng liên hệ để tích hợp.",
    });
  }

  const TYPE_LABELS: Record<ApiConnection["type"], string> = {
    hasoffers: "HasOffers",
    cake: "Cake Platform",
    custom: "Tùy chỉnh",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traffic Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi và phân tích traffic từ publisher — {company.name}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "dashboard" | "manual" | "upload" | "api")
        }
      >
        <TabsList className="h-10">
          <TabsTrigger value="dashboard" className="text-sm px-4">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="manual" className="text-sm px-4">
            Nhập thủ công
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-sm px-4">
            Upload CSV
          </TabsTrigger>
          <TabsTrigger value="api" className="text-sm px-4">
            Kết nối API
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Dashboard ───────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6 pt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard
              label="Tổng Clicks"
              value={totals.clicks.toLocaleString("vi-VN")}
              icon={MousePointerClick}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <SummaryCard
              label="Tổng Conversions"
              value={totals.conversions.toLocaleString("vi-VN")}
              icon={CheckCircle}
              color="text-green-600"
              bg="bg-green-50"
            />
            <SummaryCard
              label="Tổng Doanh thu"
              value={formatCurrency(totals.revenue)}
              icon={DollarSign}
              color="text-orange-600"
              bg="bg-orange-50"
            />
            <SummaryCard
              label="CR Trung bình"
              value={`${avgCr.toFixed(2)}%`}
              icon={TrendingUp}
              color="text-violet-600"
              bg="bg-violet-50"
            />
          </div>

          {/* Anomaly alerts */}
          {anomalies.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Cảnh báo bất thường ({anomalies.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {anomalies.map((a, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-md p-2.5 text-sm",
                      a.severity === "danger"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{a.publisher}:</span>
                    <span>{a.message}</span>
                    <Badge
                      variant={a.severity === "danger" ? "danger" : "warning"}
                      className="ml-auto shrink-0"
                    >
                      {a.severity === "danger" ? "Nguy hiểm" : "Cảnh báo"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Line chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Biểu đồ Traffic 30 ngày gần nhất
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Chưa có dữ liệu traffic. Nhập dữ liệu thủ công hoặc upload CSV.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const num = typeof value === "number" ? value : Number(value ?? 0);
                        if (name === "Doanh thu") return [formatCurrency(num), name];
                        return [num.toLocaleString("vi-VN"), name];
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="clicks"
                      name="Clicks"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="conversions"
                      name="Conversions"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      name="Doanh thu"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Per-publisher table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thống kê theo Publisher</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Publisher</TableHead>
                    <TableHead className="font-semibold text-gray-700">Tier</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Clicks</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Conversions</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Doanh thu</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">EPC</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">CR%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publisherStats.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Chưa có dữ liệu
                      </TableCell>
                    </TableRow>
                  ) : (
                    publisherStats
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((s) => (
                        <TableRow key={s.publisher_id}>
                          <TableCell className="font-medium text-gray-900">
                            {s.name}
                          </TableCell>
                          <TableCell>
                            {s.tier !== "—" ? (
                              <TierBadge tier={s.tier} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.clicks.toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.conversions.toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(s.revenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {s.epc.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "font-semibold tabular-nums",
                                s.cr > 20
                                  ? "text-red-600"
                                  : s.cr > 15
                                  ? "text-amber-600"
                                  : "text-green-700"
                              )}
                            >
                              {s.cr.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
              {publisherStats.length > 0 && (
                <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                  {publisherStats.length} publisher · 30 ngày gần nhất
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Nhập thủ công ───────────────────────────────────────────── */}
        <TabsContent value="manual" className="pt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Nhập dữ liệu thủ công</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-5">
                {/* Publisher */}
                <div className="space-y-1.5">
                  <Label htmlFor="manual-publisher">Publisher</Label>
                  <Select
                    value={manualForm.publisher_id}
                    onValueChange={(v) =>
                      setManualForm((f) => ({
                        ...f,
                        publisher_id: v === "__none__" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="manual-publisher">
                      <SelectValue placeholder="Chọn publisher (tùy chọn)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Không chọn —</SelectItem>
                      {publishers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{" "}
                          <span className="text-muted-foreground">({p.tier})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="manual-date">Ngày *</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    value={manualForm.date}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, date: e.target.value }))
                    }
                    required
                  />
                </div>

                {/* Clicks + Conversions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-clicks">Clicks *</Label>
                    <Input
                      id="manual-clicks"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manualForm.clicks}
                      onChange={(e) =>
                        setManualForm((f) => ({ ...f, clicks: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-conversions">Conversions *</Label>
                    <Input
                      id="manual-conversions"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manualForm.conversions}
                      onChange={(e) =>
                        setManualForm((f) => ({
                          ...f,
                          conversions: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                {/* Revenue */}
                <div className="space-y-1.5">
                  <Label htmlFor="manual-revenue">Doanh thu *</Label>
                  <Input
                    id="manual-revenue"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={manualForm.revenue}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, revenue: e.target.value }))
                    }
                    required
                  />
                </div>

                {/* Auto-calculated fields */}
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      EPC (tự tính)
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {manualEpc}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      CR% (tự tính)
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {manualCr}%
                    </p>
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Đang lưu..." : "Lưu dữ liệu"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent entries preview */}
          {metrics.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  5 bản ghi gần nhất
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Ngày</TableHead>
                      <TableHead className="text-xs">Publisher</TableHead>
                      <TableHead className="text-right text-xs">Clicks</TableHead>
                      <TableHead className="text-right text-xs">Conv.</TableHead>
                      <TableHead className="text-right text-xs">Revenue</TableHead>
                      <TableHead className="text-right text-xs">CR%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.slice(0, 5).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.date}</TableCell>
                        <TableCell className="text-sm">
                          {m.publishers?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {m.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {m.conversions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrency(m.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {m.cr.toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 3: Upload CSV ──────────────────────────────────────────────── */}
        <TabsContent value="upload" className="pt-4 space-y-6">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Upload dữ liệu CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Format guide */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">Định dạng CSV yêu cầu:</p>
                <p className="font-mono text-xs bg-blue-100 rounded px-2 py-1">
                  date, publisher_name, clicks, conversions, revenue
                </p>
                <p className="mt-2 text-xs text-blue-600">
                  • Ngày theo định dạng YYYY-MM-DD (ví dụ: 2026-05-01)<br />
                  • publisher_name phải khớp với tên publisher đã có trong hệ thống<br />
                  • revenue là số thực (ví dụ: 1250.50)
                </p>
              </div>

              {/* File input */}
              <div className="space-y-1.5">
                <Label htmlFor="csv-file">Chọn file</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFile}
                    className="cursor-pointer"
                  />
                  {csvFileName && (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {csvFileName}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview table */}
              {csvPreview && csvRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Xem trước ({Math.min(csvRows.length, 10)}/{csvRows.length} hàng)
                    </p>
                    {importResult && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          {importResult.success} thành công
                        </span>
                        {importResult.error > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            {importResult.error} lỗi
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(csvRows[0]).map((h) => (
                            <th
                              key={h}
                              className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-700"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {csvRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-3 py-2 text-xs text-gray-700">
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    onClick={handleCsvImport}
                    disabled={isImporting}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting
                      ? `Đang import ${csvRows.length} hàng...`
                      : `Xác nhận import ${csvRows.length} hàng`}
                  </Button>
                </div>
              )}

              {csvRows.length === 0 && !csvFileName && (
                <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 text-muted-foreground">
                  <Upload className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Chọn file CSV để bắt đầu</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Kết nối API ─────────────────────────────────────────────── */}
        <TabsContent value="api" className="pt-4 space-y-6">
          {/* Existing connections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Kết nối API ({apiConnections.length})
              </h2>
              <Button
                size="sm"
                onClick={() => setShowApiForm((v) => !v)}
                variant={showApiForm ? "outline" : "default"}
              >
                <Plus className="mr-2 h-4 w-4" />
                {showApiForm ? "Hủy" : "Thêm kết nối"}
              </Button>
            </div>

            {apiConnections.length === 0 && !showApiForm && (
              <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-muted-foreground">
                <Wifi className="h-8 w-8 opacity-30" />
                <p className="text-sm">Chưa có kết nối API nào</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {apiConnections.map((conn) => (
                <Card key={conn.id} className="relative">
                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {conn.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {TYPE_LABELS[conn.type]}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {conn.is_active ? (
                          <Badge variant="success" className="text-xs">
                            <Wifi className="mr-1 h-3 w-3" />
                            Bật
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <WifiOff className="mr-1 h-3 w-3" />
                            Tắt
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Base URL */}
                    <div>
                      <p className="text-xs text-muted-foreground">Endpoint</p>
                      <p className="text-xs font-mono text-gray-700 truncate mt-0.5">
                        {conn.base_url}
                      </p>
                    </div>

                    {/* Last sync */}
                    <div>
                      <p className="text-xs text-muted-foreground">Lần sync gần nhất</p>
                      <p className="text-xs text-gray-700 mt-0.5">
                        {conn.last_sync_at
                          ? new Date(conn.last_sync_at).toLocaleString("vi-VN")
                          : "Chưa sync"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => handleSyncConnection(conn.name)}
                      >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Sync ngay
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => handleToggleConnection(conn)}
                      >
                        {conn.is_active ? "Tắt" : "Bật"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteConnection(conn.id, conn.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Add connection form */}
          {showApiForm && (
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">Thêm kết nối mới</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddConnection} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="api-name">Tên kết nối *</Label>
                    <Input
                      id="api-name"
                      placeholder="Ví dụ: HasOffers Production"
                      value={apiForm.name}
                      onChange={(e) =>
                        setApiForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="api-type">Loại nền tảng *</Label>
                    <Select
                      value={apiForm.type}
                      onValueChange={(v) =>
                        setApiForm((f) => ({
                          ...f,
                          type: v as "hasoffers" | "cake" | "custom",
                        }))
                      }
                    >
                      <SelectTrigger id="api-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hasoffers">HasOffers</SelectItem>
                        <SelectItem value="cake">Cake Platform</SelectItem>
                        <SelectItem value="custom">Tùy chỉnh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="api-url">Base URL *</Label>
                    <Input
                      id="api-url"
                      type="url"
                      placeholder="https://api.example.com"
                      value={apiForm.base_url}
                      onChange={(e) =>
                        setApiForm((f) => ({ ...f, base_url: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="api-key">API Key *</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="••••••••••••••••"
                      value={apiForm.api_key}
                      onChange={(e) =>
                        setApiForm((f) => ({ ...f, api_key: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={isAddingConnection} className="flex-1">
                      {isAddingConnection ? "Đang lưu..." : "Thêm kết nối"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowApiForm(false)}
                    >
                      Hủy
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Summary card helper ──────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={cn("rounded-full p-3", bg)}>
            <Icon className={cn("h-6 w-6", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
