"use client";

import React, { useMemo } from "react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Users, AlertCircle, CheckCircle2, Trophy } from "lucide-react";

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

interface Employee {
  id: string;
  name: string;
  role: string;
  base_salary: number | null;
  is_active: boolean;
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

interface BonusDisplayProps {
  company: Company;
  employees: Employee[];
  selectedMonth: string; // YYYY-MM
  plRecord: PLMonthlyRecord | null;
}

interface RolePool {
  role: string;
  label: string;
  pct: number;
  pool: number;
  employeeCount: number;
  perPerson: number;
  color: string;
  bgColor: string;
}

const ROLE_LABELS: Record<string, string> = {
  pm: "Project Manager (PM)",
  bd: "Business Development (BD)",
  am: "Account Manager (AM)",
  admin: "Admin",
  custom: "Khác",
};

const ROLE_COLORS: Record<string, { color: string; bgColor: string }> = {
  pm: { color: "text-blue-700", bgColor: "bg-blue-100" },
  bd: { color: "text-purple-700", bgColor: "bg-purple-100" },
  am: { color: "text-green-700", bgColor: "bg-green-100" },
  admin: { color: "text-orange-700", bgColor: "bg-orange-100" },
  custom: { color: "text-gray-700", bgColor: "bg-gray-100" },
};

export function BonusDisplay({ company, employees, selectedMonth, plRecord }: BonusDisplayProps) {
  const monthLabel = `Tháng ${selectedMonth.split("-")[1]}/${selectedMonth.split("-")[0]}`;

  const calc = useMemo(() => {
    if (!plRecord) return null;

    const grossProfit = plRecord.revenue - plRecord.publisher_cost;
    const opex = plRecord.salary_cost + plRecord.bonus_cost + plRecord.other_cost;
    const netProfit = grossProfit - opex;

    const profitTarget = company.profit_target ?? 300;
    const isAboveTarget = netProfit > profitTarget;
    const excess = isAboveTarget ? netProfit - profitTarget : 0;
    const bonusPool = excess * ((company.bonus_pool_pct ?? 10) / 100);

    // Count active employees by role
    const activeEmployees = employees.filter((e) => e.is_active);
    const countByRole = (role: string) => activeEmployees.filter((e) => e.role === role).length;

    const pmCount = countByRole("pm");
    const bdCount = countByRole("bd");
    const amCount = countByRole("am");
    const adminCount = countByRole("admin");

    const pmPool = bonusPool * ((company.pm_pct ?? 40) / 100);
    const bdPool = bonusPool * ((company.bd_pct ?? 30) / 100);
    const amPool = bonusPool * ((company.am_pct ?? 20) / 100);
    const adminPool = bonusPool * ((company.admin_pct ?? 10) / 100);

    const rolePools: RolePool[] = [
      {
        role: "pm",
        label: ROLE_LABELS["pm"],
        pct: company.pm_pct ?? 40,
        pool: pmPool,
        employeeCount: pmCount,
        perPerson: pmCount > 0 ? pmPool / pmCount : 0,
        ...ROLE_COLORS["pm"],
      },
      {
        role: "bd",
        label: ROLE_LABELS["bd"],
        pct: company.bd_pct ?? 30,
        pool: bdPool,
        employeeCount: bdCount,
        perPerson: bdCount > 0 ? bdPool / bdCount : 0,
        ...ROLE_COLORS["bd"],
      },
      {
        role: "am",
        label: ROLE_LABELS["am"],
        pct: company.am_pct ?? 20,
        pool: amPool,
        employeeCount: amCount,
        perPerson: amCount > 0 ? amPool / amCount : 0,
        ...ROLE_COLORS["am"],
      },
      {
        role: "admin",
        label: ROLE_LABELS["admin"],
        pct: company.admin_pct ?? 10,
        pool: adminPool,
        employeeCount: adminCount,
        perPerson: adminCount > 0 ? adminPool / adminCount : 0,
        ...ROLE_COLORS["admin"],
      },
    ];

    const progressPct = profitTarget > 0 ? Math.min((netProfit / profitTarget) * 100, 100) : 0;

    return {
      netProfit,
      profitTarget,
      isAboveTarget,
      excess,
      bonusPool,
      rolePools,
      progressPct,
      activeTotal: activeEmployees.length,
    };
  }, [plRecord, company, employees]);

  if (!plRecord) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
        <AlertCircle className="h-8 w-8 text-gray-400" />
        <p className="text-muted-foreground font-medium">Chưa có dữ liệu P&L cho {monthLabel}</p>
        <p className="text-sm text-gray-400 text-center max-w-xs">
          Vui lòng nhập dữ liệu P&L ở tab &ldquo;Tổng quan P&L&rdquo; để tính bonus tự động
        </p>
      </div>
    );
  }

  if (!calc) return null;

  const { netProfit, profitTarget, isAboveTarget, excess, bonusPool, rolePools, progressPct, activeTotal } = calc;

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Tính toán Bonus Pool</h3>
          <p className="text-sm text-muted-foreground">
            {monthLabel} — {activeTotal} nhân viên đang hoạt động
          </p>
        </div>
        <Badge
          variant={isAboveTarget ? "success" : "danger"}
          className="self-start sm:self-auto text-sm px-3 py-1"
        >
          {isAboveTarget ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đạt ngưỡng lợi nhuận
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Chưa đạt ngưỡng
            </span>
          )}
        </Badge>
      </div>

      {/* Progress toward target */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Tiến độ đạt mục tiêu lợi nhuận
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>
              Lợi nhuận ròng:{" "}
              <span className={cn("font-semibold", netProfit >= 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(netProfit)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Mục tiêu: <span className="font-semibold text-foreground">{formatCurrency(profitTarget)}</span>
            </span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressPct.toFixed(1)}% đạt mục tiêu</span>
            {isAboveTarget ? (
              <span className="text-green-600 font-medium">
                Vượt {formatCurrency(excess)}
              </span>
            ) : (
              <span className="text-red-600 font-medium">
                Còn thiếu {formatCurrency(profitTarget - netProfit)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Not reached */}
      {!isAboveTarget && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="font-semibold text-amber-800">Chưa đạt ngưỡng lợi nhuận</p>
          <p className="text-sm text-amber-700 mt-1">
            Cần lợi nhuận ròng vượt{" "}
            <span className="font-medium">{formatCurrency(profitTarget)}</span> để kích hoạt bonus pool.
            Hiện tại còn thiếu{" "}
            <span className="font-medium">{formatCurrency(profitTarget - netProfit)}</span>.
          </p>
        </div>
      )}

      {/* Bonus pool summary — only show when above target */}
      {isAboveTarget && (
        <>
          {/* Bonus pool card */}
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Tổng Bonus Pool
                  </p>
                  <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(bonusPool)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatPercent(company.bonus_pool_pct ?? 10)} × {formatCurrency(excess)} (phần vượt target)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Phần vượt mục tiêu</p>
                  <p className="text-xl font-semibold text-green-600">{formatCurrency(excess)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            {rolePools.map((rp) => (
              <Card key={rp.role} className="overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{rp.label}</CardTitle>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", rp.bgColor, rp.color)}>
                      {formatPercent(rp.pct)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(rp.pool)}</p>
                      <p className="text-xs text-muted-foreground">Pool của phòng ban</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end text-muted-foreground mb-0.5">
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-xs">{rp.employeeCount} người</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {rp.employeeCount > 0 ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Mỗi người nhận (nếu đạt KPI)</p>
                      <p className={cn("text-base font-bold", rp.color)}>
                        {formatCurrency(rp.perPerson)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Chưa có nhân viên trong phòng ban này
                    </p>
                  )}

                  {/* KPI note */}
                  <p className="text-xs text-muted-foreground">
                    * Nhân viên cần KPI &ge;{" "}
                    <span className="font-medium">{company.min_kpi_threshold ?? 70}%</span> để nhận
                    bonus. Chính sách forfeit:{" "}
                    <span className="font-medium">
                      {company.bonus_forfeit_policy === "redistribute"
                        ? "Chia lại cho người đạt"
                        : "Giữ lại quỹ"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Config reference */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Cấu hình bonus hiện tại</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                {[
                  { label: "Mục tiêu lợi nhuận", value: formatCurrency(company.profit_target ?? 300) },
                  { label: "% Bonus Pool", value: formatPercent(company.bonus_pool_pct ?? 10) },
                  { label: "Ngưỡng KPI tối thiểu", value: `${company.min_kpi_threshold ?? 70}%` },
                  {
                    label: "Forfeit policy",
                    value:
                      company.bonus_forfeit_policy === "redistribute"
                        ? "Chia lại"
                        : "Giữ quỹ",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-md bg-gray-50 p-2.5">
                    <p className="text-muted-foreground">{item.label}</p>
                    <p className="font-semibold mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Thay đổi cấu hình tại{" "}
                <a href="/settings" className="underline hover:text-foreground">
                  trang Cài đặt
                </a>
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
