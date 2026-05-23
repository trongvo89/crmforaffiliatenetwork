"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { KpiRow } from "./components/kpi-row";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  role: "pm" | "bd" | "am" | "admin" | "custom";
  custom_role_name: string | null;
  base_salary: number | null;
  is_active: boolean;
}

export interface Company {
  id: string;
  profit_target: number;
  bonus_pool_pct: number;
  pm_pct: number;
  bd_pct: number;
  am_pct: number;
  admin_pct: number;
  min_kpi_threshold: number;
  bonus_forfeit_policy: "redistribute" | "retain";
}

export interface KpiRecord {
  id: string;
  employee_id: string;
  period_month: string;
  kpi_1_label: string | null;
  kpi_1_target: number | null;
  kpi_1_actual: number | null;
  kpi_2_label: string | null;
  kpi_2_target: number | null;
  kpi_2_actual: number | null;
  kpi_3_label: string | null;
  kpi_3_target: number | null;
  kpi_3_actual: number | null;
  activity_notes: string | null;
}

export interface PLRecord {
  revenue: number;
  publisher_cost: number;
  salary_cost: number;
  bonus_cost: number;
  other_cost: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonthValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function prevMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  return `Tháng ${month}/${year}`;
}

export function computeKpiScore(record: KpiRecord | null): number | null {
  if (!record) return null;
  const kpis = [
    { target: record.kpi_1_target, actual: record.kpi_1_actual },
    { target: record.kpi_2_target, actual: record.kpi_2_actual },
    { target: record.kpi_3_target, actual: record.kpi_3_actual },
  ];
  const valid = kpis.filter((k) => k.target != null && k.target > 0);
  if (valid.length === 0) return null;
  const scores = valid.map((k) =>
    Math.min(((k.actual ?? 0) / k.target!) * 100, 150)
  );
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

const ROLE_LABELS: Record<Employee["role"], string> = {
  pm: "Project Manager",
  bd: "Business Development",
  am: "Account Manager",
  admin: "Admin",
  custom: "Khác",
};

const ROLE_COLORS: Record<Employee["role"], { badge: string; text: string; bg: string }> = {
  pm: { badge: "bg-blue-100 text-blue-700", text: "text-blue-700", bg: "bg-blue-100" },
  bd: { badge: "bg-purple-100 text-purple-700", text: "text-purple-700", bg: "bg-purple-100" },
  am: { badge: "bg-green-100 text-green-700", text: "text-green-700", bg: "bg-green-100" },
  admin: { badge: "bg-orange-100 text-orange-700", text: "text-orange-700", bg: "bg-orange-100" },
  custom: { badge: "bg-gray-100 text-gray-600", text: "text-gray-600", bg: "bg-gray-100" },
};

// ─── Bonus Calculation ────────────────────────────────────────────────────────

interface RoleBonusInfo {
  role: Employee["role"];
  label: string;
  rolePool: number;
  totalActive: number;
  qualifiers: Employee[];
  nonQualifiers: Employee[];
  perPersonAmount: number;
  colorClass: string;
  bgClass: string;
}

function calcBonusByRole(
  employees: Employee[],
  kpiData: Record<string, KpiRecord>,
  plRecord: PLRecord,
  company: Company
): { bonusPool: number; netProfit: number; isAboveTarget: boolean; roleBreakdown: RoleBonusInfo[] } {
  const netProfit =
    plRecord.revenue -
    plRecord.publisher_cost -
    plRecord.salary_cost -
    plRecord.bonus_cost -
    plRecord.other_cost;

  const isAboveTarget = netProfit >= company.profit_target;
  const excess = isAboveTarget ? netProfit - company.profit_target : 0;
  const bonusPool = excess * (company.bonus_pool_pct / 100);

  const roles: Employee["role"][] = ["pm", "bd", "am", "admin"];
  const rolePctMap: Record<string, number> = {
    pm: company.pm_pct,
    bd: company.bd_pct,
    am: company.am_pct,
    admin: company.admin_pct,
  };

  const roleBreakdown: RoleBonusInfo[] = roles.map((role) => {
    const activeInRole = employees.filter((e) => e.role === role);
    const rolePool = bonusPool * (rolePctMap[role] / 100);
    const threshold = company.min_kpi_threshold;

    const qualifiers = activeInRole.filter((e) => {
      const score = computeKpiScore(kpiData[e.id] ?? null);
      return score !== null && score >= threshold;
    });
    const nonQualifiers = activeInRole.filter((e) => {
      const score = computeKpiScore(kpiData[e.id] ?? null);
      return score === null || score < threshold;
    });

    let perPersonAmount = 0;
    if (qualifiers.length > 0 && isAboveTarget) {
      if (company.bonus_forfeit_policy === "redistribute") {
        perPersonAmount = rolePool / qualifiers.length;
      } else {
        // retain: qualifiers get pool / total_active_in_role
        perPersonAmount =
          activeInRole.length > 0 ? rolePool / activeInRole.length : 0;
      }
    }

    const colors = ROLE_COLORS[role];
    return {
      role,
      label: ROLE_LABELS[role],
      rolePool,
      totalActive: activeInRole.length,
      qualifiers,
      nonQualifiers,
      perPersonAmount,
      colorClass: colors.text,
      bgClass: colors.bg,
    };
  });

  return { bonusPool, netProfit, isAboveTarget, roleBreakdown };
}

// ─── KpiClient ────────────────────────────────────────────────────────────────

interface KpiClientProps {
  employees: Employee[];
  company: Company;
  companyId: string;
  initialPlRecord: PLRecord | null;
}

export function KpiClient({
  employees,
  company,
  companyId,
  initialPlRecord,
}: KpiClientProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthValue);
  const [kpiData, setKpiData] = useState<Record<string, KpiRecord>>({});
  const [plRecord, setPlRecord] = useState<PLRecord | null>(initialPlRecord);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Fetch kpi_records and pl_monthly when month changes
  const fetchMonthData = useCallback(
    async (month: string) => {
      setLoadingRecords(true);
      const supabase = createClient();
      const periodMonthFirst = `${month}-01`;

      const employeeIds = employees.map((e) => e.id);

      // Fetch KPI records
      if (employeeIds.length > 0) {
        const { data: kpiRows } = await supabase
          .from("kpi_records")
          .select("*")
          .in("employee_id", employeeIds)
          .eq("period_month", periodMonthFirst);

        const map: Record<string, KpiRecord> = {};
        for (const row of kpiRows ?? []) {
          map[row.employee_id] = row as KpiRecord;
        }
        setKpiData(map);
      } else {
        setKpiData({});
      }

      // Fetch PL monthly
      const { data: plRows } = await supabase
        .from("pl_monthly")
        .select("*")
        .eq("company_id", companyId)
        .eq("period_month", periodMonthFirst)
        .limit(1);

      setPlRecord(plRows && plRows.length > 0 ? (plRows[0] as PLRecord) : null);
      setLoadingRecords(false);
    },
    [employees, companyId]
  );

  // Initial load for current month (merge with server-side pl record, but still fetch kpi_records)
  useEffect(() => {
    fetchMonthData(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  function handleMonthPrev() {
    setSelectedMonth((m) => prevMonth(m));
  }

  function handleMonthNext() {
    setSelectedMonth((m) => nextMonth(m));
  }

  function handleKpiSaved(rec: KpiRecord) {
    setKpiData((prev) => ({ ...prev, [rec.employee_id]: rec }));
  }

  // Bonus calc
  const bonusCalc = useMemo(() => {
    if (!plRecord) return null;
    return calcBonusByRole(employees, kpiData, plRecord, company);
  }, [plRecord, employees, kpiData, company]);

  const label = monthLabel(selectedMonth);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI & Bonus</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý KPI nhân viên và tính toán bonus hàng tháng
          </p>
        </div>
        {/* Month picker */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" size="icon" onClick={handleMonthPrev} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-gray-800">
            {label}
          </span>
          <Button variant="outline" size="icon" onClick={handleMonthNext} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Employee KPI list */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          KPI nhân viên — {label}
        </h2>

        {employees.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="text-muted-foreground">Chưa có nhân viên đang hoạt động</p>
            <a
              href="/hr"
              className="text-sm text-blue-600 underline hover:text-blue-800"
            >
              Thêm nhân viên tại trang HR
            </a>
          </div>
        ) : (
          <div className={cn("space-y-4", loadingRecords && "opacity-60 pointer-events-none")}>
            {employees.map((emp) => (
              <KpiRow
                key={emp.id}
                employee={emp}
                company={company}
                record={kpiData[emp.id] ?? null}
                selectedMonth={selectedMonth}
                onSaved={handleKpiSaved}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bonus Summary */}
      <div className="space-y-4">
        <Separator />
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h2 className="text-base font-semibold text-gray-900">
            Tổng kết Bonus — {label}
          </h2>
        </div>

        {!plRecord ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-white">
            <AlertCircle className="h-7 w-7 text-gray-400" />
            <p className="font-medium text-muted-foreground">
              Chưa có dữ liệu P&L cho {label}
            </p>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              Vui lòng nhập dữ liệu P&L ở module P&L để tính bonus tự động
            </p>
            <a
              href="/pl"
              className="text-sm text-blue-600 underline hover:text-blue-800"
            >
              Đến trang P&L
            </a>
          </div>
        ) : bonusCalc ? (
          <BonusSummarySection bonusCalc={bonusCalc} company={company} label={label} />
        ) : null}
      </div>

      <Toaster />
    </div>
  );
}

// ─── Bonus Summary Section ────────────────────────────────────────────────────

interface BonusCalcResult {
  bonusPool: number;
  netProfit: number;
  isAboveTarget: boolean;
  roleBreakdown: RoleBonusInfo[];
}

interface BonusSummarySectionProps {
  bonusCalc: BonusCalcResult;
  company: Company;
  label: string;
}

function BonusSummarySection({ bonusCalc, company, label }: BonusSummarySectionProps) {
  const { bonusPool, netProfit, isAboveTarget, roleBreakdown } = bonusCalc;

  return (
    <div className="space-y-4">
      {/* Net profit + pool summary */}
      <Card className={cn(isAboveTarget ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30")}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Lợi nhuận ròng — {label}</p>
              <p
                className={cn(
                  "text-2xl font-bold mt-0.5",
                  netProfit >= 0 ? "text-green-700" : "text-red-600"
                )}
              >
                {formatCurrency(netProfit)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Mục tiêu: {formatCurrency(company.profit_target)}
              </p>
            </div>
            <div className="text-right">
              {isAboveTarget ? (
                <>
                  <div className="flex items-center gap-1.5 justify-end text-green-700 mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Đạt ngưỡng</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Tổng Bonus Pool</p>
                  <p className="text-xl font-bold text-green-700">{formatCurrency(bonusPool)}</p>
                  <p className="text-xs text-muted-foreground">
                    {company.bonus_pool_pct}% × phần vượt target
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-1.5 justify-end text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Chưa đạt ngưỡng — Không có bonus</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role breakdown cards */}
      {isAboveTarget && (
        <div className="grid gap-4 sm:grid-cols-2">
          {roleBreakdown.map((rb) => {
            if (rb.totalActive === 0) return null;
            return (
              <Card key={rb.role} className="overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{rb.label}</CardTitle>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        rb.bgClass,
                        rb.colorClass
                      )}
                    >
                      {rb.totalActive} người
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Pool for this role */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Pool phòng ban</p>
                      <p className="text-xl font-bold">{formatCurrency(rb.rolePool)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Chính sách</p>
                      <Badge
                        className={cn(
                          "text-xs border-transparent",
                          company.bonus_forfeit_policy === "redistribute"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {company.bonus_forfeit_policy === "redistribute"
                          ? "Chia lại"
                          : "Giữ quỹ"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Qualifiers */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Đạt KPI ({rb.qualifiers.length} người) — mỗi người nhận:
                      <span className={cn("font-bold ml-1", rb.colorClass)}>
                        {rb.qualifiers.length > 0
                          ? formatCurrency(rb.perPersonAmount)
                          : "—"}
                      </span>
                    </p>
                    {rb.qualifiers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {rb.qualifiers.map((e) => (
                          <span
                            key={e.id}
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              rb.bgClass,
                              rb.colorClass
                            )}
                          >
                            {e.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Không có ai đạt ngưỡng KPI {company.min_kpi_threshold}%
                      </p>
                    )}
                  </div>

                  {/* Non-qualifiers */}
                  {rb.nonQualifiers.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        Chưa đạt KPI ({rb.nonQualifiers.length} người)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rb.nonQualifiers.map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500"
                          >
                            {e.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground pt-1">
                    * Ngưỡng KPI tối thiểu:{" "}
                    <span className="font-medium">{company.min_kpi_threshold}%</span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
