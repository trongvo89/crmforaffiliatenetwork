"use client";

import React, { useState, useMemo, useCallback } from "react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, PencilLine, BarChart2, AlertCircle } from "lucide-react";
import { PLForm } from "./components/pl-form";
import { CampaignSection, type Campaign, type CampaignPL } from "./components/campaign-section";
import { BonusDisplay } from "./components/bonus-display";
import { Toaster } from "@/components/ui/toaster";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  profit_target: number;
  bonus_pool_pct: number;
  pm_pct: number;
  bd_pct: number;
  am_pct: number;
  admin_pct: number;
  min_kpi_threshold: number;
  bonus_forfeit_policy: "redistribute" | "retain";
}

interface PLMonthlyRecord {
  id: string;
  company_id: string;
  period_month: string;
  revenue: number;
  publisher_cost: number;
  salary_cost: number;
  bonus_cost: number;
  other_cost: number;
  notes: string | null;
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

interface Employee {
  id: string;
  name: string;
  role: string;
  base_salary: number | null;
  is_active: boolean;
}

interface PLClientProps {
  company: Company;
  plMonthly: PLMonthlyRecord[];
  campaigns: Campaign[];
  advertisers: Advertiser[];
  offers: Offer[];
  campaignPL: CampaignPL[];
  employees: Employee[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  // last 12 months + 1 future
  for (let i = 11; i >= -1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    options.push({ value: `${year}-${month}`, label: `Tháng ${month}/${year}` });
  }
  return options;
}

function calcPL(record: PLMonthlyRecord) {
  const grossProfit = record.revenue - record.publisher_cost;
  const grossMarginPct = record.revenue > 0 ? (grossProfit / record.revenue) * 100 : 0;
  const opex = record.salary_cost + record.bonus_cost + record.other_cost;
  const netProfit = grossProfit - opex;
  const netMarginPct = record.revenue > 0 ? (netProfit / record.revenue) * 100 : 0;
  return { grossProfit, grossMarginPct, opex, netProfit, netMarginPct };
}

function formatMonth(periodMonth: string): string {
  const parts = periodMonth.split("-");
  return `T${parts[1]}/${parts[0]}`;
}

function currentMonthValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// ─── MoM Change Badge ─────────────────────────────────────────────────────────

interface MoMBadgeProps {
  current: number;
  previous: number | undefined;
}

function MoMBadge({ current, previous }: MoMBadgeProps) {
  if (previous === undefined || previous === null) {
    return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> N/A</span>;
  }
  if (previous === 0) {
    return <span className="text-xs text-muted-foreground">Tháng trước: 0</span>;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = pct >= 0;
  return (
    <span
      className={cn(
        "text-xs font-medium flex items-center gap-0.5",
        isUp ? "text-green-600" : "text-red-600"
      )}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isUp ? "+" : ""}
      {pct.toFixed(1)}% MoM
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: number;
  sub?: string;
  previousValue?: number;
  valueClass?: string;
  icon?: React.ReactNode;
}

function SummaryCard({ title, value, sub, previousValue, valueClass, icon }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={cn("text-2xl font-bold", valueClass)}>
          {formatCurrency(value)}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        <MoMBadge current={value} previous={previousValue} />
      </CardContent>
    </Card>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function PLClient({
  company,
  plMonthly: initialPLMonthly,
  campaigns: initialCampaigns,
  advertisers,
  offers,
  campaignPL: initialCampaignPL,
  employees,
}: PLClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [plMonthly, setPLMonthly] = useState<PLMonthlyRecord[]>(initialPLMonthly);
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [campaignPL, setCampaignPL] = useState<CampaignPL[]>(initialCampaignPL);
  const [formOpen, setFormOpen] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Current month's PL record
  const currentRecord = useMemo(
    () =>
      plMonthly.find((r) => r.period_month.startsWith(selectedMonth)) ?? null,
    [plMonthly, selectedMonth]
  );

  // Previous month's PL record
  const prevRecord = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1); // month-2 because month is 1-indexed
    const prevYYYY = prevDate.getFullYear();
    const prevMM = String(prevDate.getMonth() + 1).padStart(2, "0");
    const prevKey = `${prevYYYY}-${prevMM}`;
    return plMonthly.find((r) => r.period_month.startsWith(prevKey)) ?? null;
  }, [plMonthly, selectedMonth]);

  // Calculated values for current month
  const currentCalc = useMemo(
    () => (currentRecord ? calcPL(currentRecord) : null),
    [currentRecord]
  );

  const prevCalc = useMemo(
    () => (prevRecord ? calcPL(prevRecord) : null),
    [prevRecord]
  );

  // Last 6 months sorted
  const last6Months = useMemo(() => {
    const sorted = [...plMonthly].sort(
      (a, b) => new Date(a.period_month).getTime() - new Date(b.period_month).getTime()
    );
    return sorted.slice(-6);
  }, [plMonthly]);

  // Chart data
  const chartData = useMemo(
    () =>
      last6Months.map((r) => {
        const { grossProfit, netProfit } = calcPL(r);
        return {
          month: formatMonth(r.period_month),
          "Doanh thu": r.revenue,
          "Gross Profit": grossProfit,
          "Lợi nhuận ròng": netProfit,
        };
      }),
    [last6Months]
  );

  // Handle PL form success
  const handlePLSuccess = useCallback((record: PLMonthlyRecord) => {
    setPLMonthly((prev) => {
      const exists = prev.find(
        (r) => r.period_month === record.period_month && r.company_id === record.company_id
      );
      if (exists) {
        return prev.map((r) =>
          r.period_month === record.period_month && r.company_id === record.company_id
            ? record
            : r
        );
      }
      return [...prev, record];
    });
  }, []);

  const monthLabel = `Tháng ${selectedMonth.split("-")[1]}/${selectedMonth.split("-")[0]}`;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L & Dòng tiền</h1>
          <p className="text-sm text-muted-foreground">
            {company.name} — Quản lý lợi nhuận và phân tích tài chính
          </p>
        </div>
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Xem tháng:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="overview">Tổng quan P&L</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign</TabsTrigger>
          <TabsTrigger value="bonus">Bonus Pool</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {currentRecord ? `Đã nhập dữ liệu cho ${monthLabel}` : `Chưa có dữ liệu cho ${monthLabel}`}
            </p>
            <Button onClick={() => setFormOpen(true)} size="sm">
              <PencilLine className="h-4 w-4 mr-1.5" />
              {currentRecord ? "Sửa P&L tháng này" : "Nhập P&L tháng này"}
            </Button>
          </div>

          {/* Summary cards */}
          {currentRecord && currentCalc ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard
                title="Doanh thu"
                value={currentRecord.revenue}
                previousValue={prevRecord?.revenue}
                valueClass="text-blue-700"
              />
              <SummaryCard
                title="Chi phí Publisher"
                value={currentRecord.publisher_cost}
                previousValue={prevRecord?.publisher_cost}
                valueClass="text-orange-600"
                sub={currentRecord.revenue > 0
                  ? `${formatPercent(currentRecord.publisher_cost / currentRecord.revenue * 100)} doanh thu`
                  : undefined}
              />
              <SummaryCard
                title="Gross Profit"
                value={currentCalc.grossProfit}
                sub={`Margin: ${formatPercent(currentCalc.grossMarginPct)}`}
                previousValue={prevCalc?.grossProfit}
                valueClass={currentCalc.grossProfit >= 0 ? "text-green-600" : "text-red-600"}
              />
              <SummaryCard
                title="OpEx"
                value={currentCalc.opex}
                previousValue={prevCalc?.opex}
                valueClass="text-purple-600"
                sub={`Lương: ${formatCurrency(currentRecord.salary_cost)}`}
              />
              <SummaryCard
                title="Lợi nhuận ròng"
                value={currentCalc.netProfit}
                sub={`Net Margin: ${formatPercent(currentCalc.netMarginPct)}`}
                previousValue={prevCalc?.netProfit}
                valueClass={currentCalc.netProfit >= 0 ? "text-green-700" : "text-red-700"}
                icon={currentCalc.netProfit >= (company.profit_target ?? 300) ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              />
            </div>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-white">
              <AlertCircle className="h-6 w-6 text-gray-400" />
              <p className="text-muted-foreground">Chưa có dữ liệu P&L cho {monthLabel}</p>
              <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                <PencilLine className="h-4 w-4 mr-1" />
                Nhập ngay
              </Button>
            </div>
          )}

          {/* Chart - 6 months */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
                Xu hướng 6 tháng gần nhất
              </CardTitle>
              <CardDescription>So sánh doanh thu, gross profit và lợi nhuận ròng (M)</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-muted-foreground text-sm">Chưa có dữ liệu để vẽ biểu đồ</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}M`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString("vi-VN")}M`, ""]}
                      contentStyle={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Doanh thu" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Gross Profit" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Lợi nhuận ròng" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 6-month breakdown table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chi tiết P&L 6 tháng</CardTitle>
              <CardDescription>Đơn vị: triệu VND (M)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {last6Months.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="text-muted-foreground text-sm">Chưa có dữ liệu</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Tháng</TableHead>
                      <TableHead className="text-right">Doanh thu</TableHead>
                      <TableHead className="text-right">Chi phí PUB</TableHead>
                      <TableHead className="text-right">Gross Profit</TableHead>
                      <TableHead className="text-right">Gross %</TableHead>
                      <TableHead className="text-right">OpEx</TableHead>
                      <TableHead className="text-right">Lợi nhuận ròng</TableHead>
                      <TableHead className="text-right">Net %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {last6Months.map((record) => {
                      const { grossProfit, grossMarginPct, opex, netProfit, netMarginPct } = calcPL(record);
                      const isCurrentMonth = record.period_month.startsWith(selectedMonth);
                      return (
                        <TableRow
                          key={record.id}
                          className={cn(isCurrentMonth && "bg-blue-50/60 font-medium")}
                        >
                          <TableCell className="font-medium">
                            {formatMonth(record.period_month)}
                            {isCurrentMonth && (
                              <span className="ml-1.5 text-xs text-blue-600 font-normal">• hiện tại</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(record.revenue)}</TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatCurrency(record.publisher_cost)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              grossProfit >= 0 ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {formatCurrency(grossProfit)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatPercent(grossMarginPct)}
                          </TableCell>
                          <TableCell className="text-right text-purple-600">
                            {formatCurrency(opex)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold",
                              netProfit >= 0 ? "text-green-700" : "text-red-700"
                            )}
                          >
                            {formatCurrency(netProfit)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right text-sm",
                              netMarginPct >= 0 ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {formatPercent(netMarginPct)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Cost breakdown for selected month */}
          {currentRecord && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Chi tiết Chi phí — {monthLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Lương", value: currentRecord.salary_cost, color: "text-blue-600" },
                    { label: "Thưởng", value: currentRecord.bonus_cost, color: "text-amber-600" },
                    { label: "Chi phí khác", value: currentRecord.other_cost, color: "text-gray-600" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className={cn("text-xl font-bold mt-1", item.color)}>
                        {formatCurrency(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
                {currentRecord.notes && (
                  <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Ghi chú:</span> {currentRecord.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: Campaigns ── */}
        <TabsContent value="campaigns" className="space-y-4">
          <CampaignSection
            companyId={company.id}
            campaigns={campaigns}
            campaignPL={campaignPL}
            advertisers={advertisers}
            offers={offers}
            selectedMonth={selectedMonth}
            onCampaignsChange={setCampaigns}
            onCampaignPLChange={setCampaignPL}
          />
        </TabsContent>

        {/* ── Tab 3: Bonus Pool ── */}
        <TabsContent value="bonus" className="space-y-4">
          <BonusDisplay
            company={company}
            employees={employees}
            selectedMonth={selectedMonth}
            plRecord={currentRecord}
          />
        </TabsContent>
      </Tabs>

      {/* PL Form Dialog */}
      <PLForm
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={company.id}
        selectedMonth={selectedMonth}
        existingRecord={currentRecord}
        onSuccess={handlePLSuccess}
      />

      <Toaster />
    </div>
  );
}
