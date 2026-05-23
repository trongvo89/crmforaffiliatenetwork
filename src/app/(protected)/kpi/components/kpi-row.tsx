"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Company, KpiRecord } from "../kpi-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Employee["role"], string> = {
  pm: "PM",
  bd: "BD",
  am: "AM",
  admin: "Admin",
  custom: "Khác",
};

const ROLE_BADGE: Record<Employee["role"], string> = {
  pm: "bg-blue-100 text-blue-700",
  bd: "bg-purple-100 text-purple-700",
  am: "bg-green-100 text-green-700",
  admin: "bg-orange-100 text-orange-700",
  custom: "bg-gray-100 text-gray-600",
};

function computeKpiScore(target: number | null, actual: number | null): number | null {
  if (target == null || target <= 0) return null;
  return Math.min(((actual ?? 0) / target) * 100, 150);
}

function computeOverallScore(scores: Array<number | null>): number | null {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function scoreColorClass(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 90) return "text-green-600 font-semibold";
  if (score >= 70) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

function overallBgClass(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-500";
  if (score >= 90) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

// ─── KpiRow Props ─────────────────────────────────────────────────────────────

interface KpiRowProps {
  employee: Employee;
  company: Company;
  record: KpiRecord | null;
  selectedMonth: string; // YYYY-MM
  onSaved: (rec: KpiRecord) => void;
}

// ─── KpiRow Component ─────────────────────────────────────────────────────────

export function KpiRow({ employee, company, record, selectedMonth, onSaved }: KpiRowProps) {
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);

  // KPI fields state
  const [kpi1Label, setKpi1Label] = useState(record?.kpi_1_label ?? "");
  const [kpi1Target, setKpi1Target] = useState<string>(
    record?.kpi_1_target != null ? String(record.kpi_1_target) : ""
  );
  const [kpi1Actual, setKpi1Actual] = useState<string>(
    record?.kpi_1_actual != null ? String(record.kpi_1_actual) : ""
  );

  const [kpi2Label, setKpi2Label] = useState(record?.kpi_2_label ?? "");
  const [kpi2Target, setKpi2Target] = useState<string>(
    record?.kpi_2_target != null ? String(record.kpi_2_target) : ""
  );
  const [kpi2Actual, setKpi2Actual] = useState<string>(
    record?.kpi_2_actual != null ? String(record.kpi_2_actual) : ""
  );

  const [kpi3Label, setKpi3Label] = useState(record?.kpi_3_label ?? "");
  const [kpi3Target, setKpi3Target] = useState<string>(
    record?.kpi_3_target != null ? String(record.kpi_3_target) : ""
  );
  const [kpi3Actual, setKpi3Actual] = useState<string>(
    record?.kpi_3_actual != null ? String(record.kpi_3_actual) : ""
  );

  // Sync when record or month changes — selectedMonth ensures null→null transitions also reset
  useEffect(() => {
    setKpi1Label(record?.kpi_1_label ?? "");
    setKpi1Target(record?.kpi_1_target != null ? String(record.kpi_1_target) : "");
    setKpi1Actual(record?.kpi_1_actual != null ? String(record.kpi_1_actual) : "");
    setKpi2Label(record?.kpi_2_label ?? "");
    setKpi2Target(record?.kpi_2_target != null ? String(record.kpi_2_target) : "");
    setKpi2Actual(record?.kpi_2_actual != null ? String(record.kpi_2_actual) : "");
    setKpi3Label(record?.kpi_3_label ?? "");
    setKpi3Target(record?.kpi_3_target != null ? String(record.kpi_3_target) : "");
    setKpi3Actual(record?.kpi_3_actual != null ? String(record.kpi_3_actual) : "");
  }, [record, selectedMonth]);

  const parseNum = (val: string): number | null => {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  // Compute scores
  const score1 = computeKpiScore(parseNum(kpi1Target), parseNum(kpi1Actual));
  const score2 = computeKpiScore(parseNum(kpi2Target), parseNum(kpi2Actual));
  const score3 = computeKpiScore(parseNum(kpi3Target), parseNum(kpi3Actual));
  const overallScore = computeOverallScore([score1, score2, score3]);

  const kpis = [
    {
      label: kpi1Label, setLabel: setKpi1Label,
      target: kpi1Target, setTarget: setKpi1Target,
      actual: kpi1Actual, setActual: setKpi1Actual,
      score: score1,
      num: 1,
    },
    {
      label: kpi2Label, setLabel: setKpi2Label,
      target: kpi2Target, setTarget: setKpi2Target,
      actual: kpi2Actual, setActual: setKpi2Actual,
      score: score2,
      num: 2,
    },
    {
      label: kpi3Label, setLabel: setKpi3Label,
      target: kpi3Target, setTarget: setKpi3Target,
      actual: kpi3Actual, setActual: setKpi3Actual,
      score: score3,
      num: 3,
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    try {
      const periodMonth = `${selectedMonth}-01`;

      const payload = {
        employee_id: employee.id,
        period_month: periodMonth,
        kpi_1_label: kpi1Label || null,
        kpi_1_target: parseNum(kpi1Target),
        kpi_1_actual: parseNum(kpi1Actual),
        kpi_2_label: kpi2Label || null,
        kpi_2_target: parseNum(kpi2Target),
        kpi_2_actual: parseNum(kpi2Actual),
        kpi_3_label: kpi3Label || null,
        kpi_3_target: parseNum(kpi3Target),
        kpi_3_actual: parseNum(kpi3Actual),
        activity_notes: record?.activity_notes ?? null,
      };

      const { data, error } = await supabase
        .from("kpi_records")
        .upsert(payload, { onConflict: "employee_id,period_month" })
        .select("*")
        .single();

      if (error) throw error;

      toast({
        title: "Đã lưu KPI",
        description: `KPI của ${employee.name} tháng ${selectedMonth.split("-")[1]}/${selectedMonth.split("-")[0]} đã được lưu.`,
      });

      if (data) {
        onSaved(data as KpiRecord);
      }
    } catch (err) {
      console.error("Error saving KPI:", err);
      toast({
        title: "Lỗi khi lưu",
        description: "Không thể lưu KPI. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel =
    employee.role === "custom"
      ? (employee.custom_role_name ?? "Khác")
      : ROLE_LABELS[employee.role];

  const meetsThreshold =
    overallScore !== null && overallScore >= (company.min_kpi_threshold ?? 70);

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4 shadow-sm">
      {/* Employee header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{employee.name}</p>
            {employee.email && (
              <p className="text-xs text-muted-foreground">{employee.email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              ROLE_BADGE[employee.role]
            )}
          >
            {roleLabel}
          </span>
          {overallScore !== null && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                overallBgClass(overallScore)
              )}
            >
              Tổng KPI: {overallScore.toFixed(1)}%{meetsThreshold ? " ✓" : " ✗"}
            </span>
          )}
        </div>
      </div>

      {/* KPI rows */}
      <div className="space-y-2">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-1">
          <p className="text-xs font-medium text-muted-foreground">Tên KPI</p>
          <p className="text-xs font-medium text-muted-foreground text-center">Mục tiêu</p>
          <p className="text-xs font-medium text-muted-foreground text-center">Thực tế</p>
          <p className="text-xs font-medium text-muted-foreground text-center">Điểm</p>
        </div>

        {kpis.map((kpi) => (
          <div key={kpi.num} className="grid grid-cols-[1fr_100px_100px_80px] gap-2 items-center">
            <Input
              placeholder={`KPI ${kpi.num} (vd: Doanh thu)`}
              value={kpi.label}
              onChange={(e) => kpi.setLabel(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="0"
              value={kpi.target}
              onChange={(e) => kpi.setTarget(e.target.value)}
              className="h-8 text-sm text-center"
              min={0}
            />
            <Input
              type="number"
              placeholder="0"
              value={kpi.actual}
              onChange={(e) => kpi.setActual(e.target.value)}
              className="h-8 text-sm text-center"
              min={0}
            />
            <div className="flex items-center justify-center">
              {kpi.score !== null ? (
                <span className={cn("text-sm tabular-nums", scoreColorClass(kpi.score))}>
                  {kpi.score.toFixed(1)}%
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: overall score + save */}
      <div className="flex items-center justify-between pt-1 border-t gap-3">
        <div className="text-sm text-muted-foreground">
          {overallScore !== null ? (
            <span>
              Điểm tổng:{" "}
              <span className={cn("font-semibold", scoreColorClass(overallScore))}>
                {overallScore.toFixed(1)}%
              </span>
              <span className="ml-2 text-xs">
                {meetsThreshold
                  ? `(Đạt ngưỡng ${company.min_kpi_threshold}%)`
                  : `(Chưa đạt ngưỡng ${company.min_kpi_threshold}%)`}
              </span>
            </span>
          ) : (
            <span>Chưa có dữ liệu KPI</span>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Đang lưu...
            </>
          ) : (
            "Lưu"
          )}
        </Button>
      </div>
    </div>
  );
}
