"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";

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

interface PLFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  selectedMonth: string; // YYYY-MM
  existingRecord: PLMonthlyRecord | null;
  onSuccess: (record: PLMonthlyRecord) => void;
}

function generateMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 11; i >= -2; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const value = `${year}-${month}`;
    const label = `Tháng ${month}/${year}`;
    options.push({ value, label });
  }
  return options;
}

export function PLForm({
  open,
  onOpenChange,
  companyId,
  selectedMonth,
  existingRecord,
  onSuccess,
}: PLFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [month, setMonth] = useState(selectedMonth);
  const [revenue, setRevenue] = useState("");
  const [publisherCost, setPublisherCost] = useState("");
  const [salaryCost, setSalaryCost] = useState("");
  const [bonusCost, setBonusCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [notes, setNotes] = useState("");

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    if (open) {
      if (existingRecord) {
        const [year, mm] = existingRecord.period_month.split("-");
        setMonth(`${year}-${mm}`);
        setRevenue(String(existingRecord.revenue ?? ""));
        setPublisherCost(String(existingRecord.publisher_cost ?? ""));
        setSalaryCost(String(existingRecord.salary_cost ?? ""));
        setBonusCost(String(existingRecord.bonus_cost ?? ""));
        setOtherCost(String(existingRecord.other_cost ?? ""));
        setNotes(existingRecord.notes ?? "");
      } else {
        setMonth(selectedMonth);
        setRevenue("");
        setPublisherCost("");
        setSalaryCost("");
        setBonusCost("");
        setOtherCost("");
        setNotes("");
      }
    }
  }, [open, existingRecord, selectedMonth]);

  const rev = parseFloat(revenue) || 0;
  const pubCost = parseFloat(publisherCost) || 0;
  const salCost = parseFloat(salaryCost) || 0;
  const bonCost = parseFloat(bonusCost) || 0;
  const othCost = parseFloat(otherCost) || 0;

  const grossProfit = rev - pubCost;
  const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;
  const opex = salCost + bonCost + othCost;
  const netProfit = grossProfit - opex;
  const netMarginPct = rev > 0 ? (netProfit / rev) * 100 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!month) {
      toast({ title: "Lỗi", description: "Vui lòng chọn tháng", variant: "destructive" });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const periodMonth = `${month}-01`;

    const payload = {
      company_id: companyId,
      period_month: periodMonth,
      revenue: rev,
      publisher_cost: pubCost,
      salary_cost: salCost,
      bonus_cost: bonCost,
      other_cost: othCost,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingRecord) {
      result = await supabase
        .from("pl_monthly")
        .update(payload)
        .eq("id", existingRecord.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("pl_monthly")
        .upsert(payload, { onConflict: "company_id,period_month" })
        .select()
        .single();
    }

    setLoading(false);

    if (result.error) {
      toast({
        title: "Lỗi lưu dữ liệu",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Lưu thành công",
      description: `Đã lưu P&L tháng ${month.split("-")[1]}/${month.split("-")[0]}`,
    });
    onSuccess(result.data as PLMonthlyRecord);
    onOpenChange(false);
  }

  const formatCalc = (val: number) =>
    val === 0 ? "0M" : formatCurrency(val);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingRecord ? "Sửa P&L tháng" : "Nhập P&L tháng mới"}
          </DialogTitle>
          <DialogDescription>
            Nhập số liệu doanh thu và chi phí tháng. Đơn vị: triệu VND (M).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Month picker */}
          <div className="grid gap-1.5">
            <Label htmlFor="pl-month">Tháng *</Label>
            <Select value={month} onValueChange={setMonth} disabled={!!existingRecord}>
              <SelectTrigger id="pl-month">
                <SelectValue placeholder="Chọn tháng" />
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

          {/* Revenue section */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="revenue">Doanh thu (M)</Label>
              <Input
                id="revenue"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="publisher-cost">Chi phí Publisher (M)</Label>
              <Input
                id="publisher-cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={publisherCost}
                onChange={(e) => setPublisherCost(e.target.value)}
              />
            </div>
          </div>

          {/* Costs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="salary-cost">Lương (M)</Label>
              <Input
                id="salary-cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={salaryCost}
                onChange={(e) => setSalaryCost(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bonus-cost">Thưởng (M)</Label>
              <Input
                id="bonus-cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={bonusCost}
                onChange={(e) => setBonusCost(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="other-cost">Chi phí khác (M)</Label>
              <Input
                id="other-cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú thêm về tháng này..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Auto-calculated preview */}
          <Separator />
          <div className="rounded-lg bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Kết quả tính toán tự động</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-white border p-3">
                <p className="text-xs text-muted-foreground">Gross Profit</p>
                <p
                  className={`text-base font-bold ${
                    grossProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCalc(grossProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {grossMarginPct.toFixed(1)}% margin
                </p>
              </div>
              <div className="rounded-md bg-white border p-3">
                <p className="text-xs text-muted-foreground">OpEx</p>
                <p className="text-base font-bold text-orange-600">{formatCalc(opex)}</p>
                <p className="text-xs text-muted-foreground">
                  Lương + Thưởng + Khác
                </p>
              </div>
              <div className="rounded-md bg-white border p-3 col-span-2">
                <p className="text-xs text-muted-foreground">Lợi nhuận ròng</p>
                <p
                  className={`text-base font-bold ${
                    netProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCalc(netProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {netMarginPct.toFixed(1)}% net margin
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu P&L"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
