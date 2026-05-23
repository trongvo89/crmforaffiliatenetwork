"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2, Target, Users, Shield } from "lucide-react";

interface Company {
  id: string;
  name: string;
  profit_target: number | null;
  bonus_pool_pct: number | null;
  pm_pct: number | null;
  bd_pct: number | null;
  am_pct: number | null;
  admin_pct: number | null;
  min_kpi_threshold: number | null;
  bonus_forfeit_policy: string | null;
  fraud_platinum_threshold: number | null;
  fraud_gold_threshold: number | null;
  fraud_silver_threshold: number | null;
  fraud_bronze_threshold: number | null;
}

interface SettingsClientProps {
  initialCompany: Company | null;
}

export function SettingsClient({ initialCompany }: SettingsClientProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [company, setCompany] = React.useState<Company | null>(initialCompany);

  const [name, setName] = React.useState(initialCompany?.name ?? "");
  const [profitTarget, setProfitTarget] = React.useState(
    String(initialCompany?.profit_target ?? 300)
  );
  const [bonusPoolPct, setBonusPoolPct] = React.useState(
    String(initialCompany?.bonus_pool_pct ?? 10)
  );
  const [pmPct, setPmPct] = React.useState(String(initialCompany?.pm_pct ?? 40));
  const [bdPct, setBdPct] = React.useState(String(initialCompany?.bd_pct ?? 30));
  const [amPct, setAmPct] = React.useState(String(initialCompany?.am_pct ?? 20));
  const [adminPct, setAdminPct] = React.useState(
    String(initialCompany?.admin_pct ?? 10)
  );
  const [minKpiThreshold, setMinKpiThreshold] = React.useState(
    String(initialCompany?.min_kpi_threshold ?? 70)
  );
  const [bonusForfeitPolicy, setBonusForfeitPolicy] = React.useState(
    initialCompany?.bonus_forfeit_policy ?? "redistribute"
  );
  const [fraudPlatinum, setFraudPlatinum] = React.useState(
    String(initialCompany?.fraud_platinum_threshold ?? 0.5)
  );
  const [fraudGold, setFraudGold] = React.useState(
    String(initialCompany?.fraud_gold_threshold ?? 1.0)
  );
  const [fraudSilver, setFraudSilver] = React.useState(
    String(initialCompany?.fraud_silver_threshold ?? 2.0)
  );
  const [fraudBronze, setFraudBronze] = React.useState(
    String(initialCompany?.fraud_bronze_threshold ?? 3.0)
  );

  const roleTotal =
    (parseFloat(pmPct) || 0) +
    (parseFloat(bdPct) || 0) +
    (parseFloat(amPct) || 0) +
    (parseFloat(adminPct) || 0);

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Lỗi", description: "Tên công ty là bắt buộc.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const payload = {
      name: name.trim(),
      profit_target: parseFloat(profitTarget) || 0,
      bonus_pool_pct: parseFloat(bonusPoolPct) || 0,
      pm_pct: parseFloat(pmPct) || 0,
      bd_pct: parseFloat(bdPct) || 0,
      am_pct: parseFloat(amPct) || 0,
      admin_pct: parseFloat(adminPct) || 0,
      min_kpi_threshold: parseFloat(minKpiThreshold) || 70,
      bonus_forfeit_policy: bonusForfeitPolicy,
      fraud_platinum_threshold: parseFloat(fraudPlatinum) || 0.5,
      fraud_gold_threshold: parseFloat(fraudGold) || 1.0,
      fraud_silver_threshold: parseFloat(fraudSilver) || 2.0,
      fraud_bronze_threshold: parseFloat(fraudBronze) || 3.0,
      updated_at: new Date().toISOString(),
    };

    let data, error;
    if (company?.id) {
      ({ data, error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", company.id)
        .select("*")
        .single());
    } else {
      ({ data, error } = await supabase
        .from("companies")
        .insert(payload)
        .select("*")
        .single());
    }

    setSaving(false);

    if (error) {
      toast({ title: "Lỗi lưu", description: error.message, variant: "destructive" });
      return;
    }

    setCompany(data as Company);
    toast({ title: company?.id ? "Đã cập nhật cài đặt" : "Đã tạo công ty thành công!" });
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cấu hình thông tin công ty và các thông số vận hành
        </p>
      </div>

      {/* Company Info */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Thông tin công ty</h2>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Tên công ty *</Label>
          <Input
            id="name"
            placeholder="vd: Cityads Vietnam"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </section>

      {/* P&L Targets */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-5 w-5 text-green-600" />
          <h2 className="text-base font-semibold text-gray-900">Mục tiêu P&L & Bonus</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profitTarget">Mục tiêu lợi nhuận (triệu VNĐ/tháng)</Label>
            <Input
              id="profitTarget"
              type="number"
              min={0}
              value={profitTarget}
              onChange={(e) => setProfitTarget(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bonusPoolPct">Tỷ lệ quỹ bonus (% lợi nhuận vượt target)</Label>
            <Input
              id="bonusPoolPct"
              type="number"
              min={0}
              max={100}
              value={bonusPoolPct}
              onChange={(e) => setBonusPoolPct(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Chính sách phần thưởng bị mất (khi nhân viên không đạt KPI)</Label>
          <Select value={bonusForfeitPolicy} onValueChange={setBonusForfeitPolicy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="redistribute">Redistribute — chia lại cho người đạt</SelectItem>
              <SelectItem value="retain">Retain — giữ lại quỹ công ty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Role Bonus Split */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">Phân bổ bonus theo vai trò</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Tổng phân bổ: {" "}
          <span className={roleTotal === 100 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
            {roleTotal}%
          </span>
          {roleTotal !== 100 && " (phải bằng 100%)"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "PM (%)", value: pmPct, set: setPmPct },
            { label: "BD (%)", value: bdPct, set: setBdPct },
            { label: "AM (%)", value: amPct, set: setAmPct },
            { label: "Admin (%)", value: adminPct, set: setAdminPct },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="minKpiThreshold">Ngưỡng KPI tối thiểu để nhận bonus (%)</Label>
          <Input
            id="minKpiThreshold"
            type="number"
            min={0}
            max={100}
            value={minKpiThreshold}
            onChange={(e) => setMinKpiThreshold(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </section>

      {/* Fraud Thresholds */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-red-600" />
          <h2 className="text-base font-semibold text-gray-900">Ngưỡng phát hiện Fraud (%)</h2>
        </div>
        <p className="text-sm text-muted-foreground">Tỷ lệ conversion tối đa chấp nhận theo tier publisher</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Platinum (≤ %)", value: fraudPlatinum, set: setFraudPlatinum },
            { label: "Gold (≤ %)", value: fraudGold, set: setFraudGold },
            { label: "Silver (≤ %)", value: fraudSilver, set: setFraudSilver },
            { label: "Bronze (≤ %)", value: fraudBronze, set: setFraudBronze },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : company?.id ? (
            "Lưu thay đổi"
          ) : (
            "Tạo công ty"
          )}
        </Button>
      </div>
    </div>
  );
}
