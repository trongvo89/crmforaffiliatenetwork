"use client";

import React, { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldMapping {
  endpoint: string;
  auth_in: "query" | "header";
  auth_param_name: string;
  date_start_param: string;
  date_end_param: string;
  extra_params: string;
  revenue_path: string;
  cost_path: string;
}

interface ApiConnection {
  id: string;
  name: string;
  type: "hasoffers" | "cake" | "custom";
  base_url: string;
  api_key: string;
  is_active: boolean;
  field_mapping: Partial<FieldMapping> | null;
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

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  selectedMonth: string;
  currentRecord: PLMonthlyRecord | null;
  onSuccess: (record: PLMonthlyRecord) => void;
}

// ─── Defaults by type ─────────────────────────────────────────────────────────

const TYPE_DEFAULTS: Record<string, FieldMapping> = {
  hasoffers: {
    endpoint: "/api/Affiliate/getStats",
    auth_in: "query",
    auth_param_name: "api_key",
    date_start_param: "data_start",
    date_end_param: "data_end",
    extra_params: "Method=getStats",
    revenue_path: "data.totals.revenue",
    cost_path: "data.totals.publisher_revenue",
  },
  cake: {
    endpoint: "/api/1/reports.asmx",
    auth_in: "query",
    auth_param_name: "api_key",
    date_start_param: "start_date",
    date_end_param: "end_date",
    extra_params: "Method=GetReportByOffer",
    revenue_path: "d.total_revenue",
    cost_path: "d.total_cost",
  },
  custom: {
    endpoint: "",
    auth_in: "query",
    auth_param_name: "api_key",
    date_start_param: "start_date",
    date_end_param: "end_date",
    extra_params: "",
    revenue_path: "",
    cost_path: "",
  },
};

function buildDefaultMapping(conn: ApiConnection): FieldMapping {
  const saved = conn.field_mapping ?? {};
  const defaults = TYPE_DEFAULTS[conn.type] ?? TYPE_DEFAULTS.custom;
  return { ...defaults, ...saved } as FieldMapping;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApiSyncDialog({
  open,
  onClose,
  companyId,
  selectedMonth,
  currentRecord,
  onSuccess,
}: Props) {
  const supabase = createClient();
  const { toast } = useToast();

  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [mapping, setMapping] = useState<FieldMapping>(TYPE_DEFAULTS.custom);
  const [showMapping, setShowMapping] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  const [previewRevenue, setPreviewRevenue] = useState<string>("");
  const [previewCost, setPreviewCost] = useState<string>("");
  const [previewStep, setPreviewStep] = useState(false);
  const [fetchError, setFetchError] = useState<string>("");

  // Load API connections on open
  useEffect(() => {
    if (!open) return;
    supabase
      .from("api_connections")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .then(({ data }) => {
        setConnections((data as ApiConnection[]) ?? []);
        if (data && data.length > 0) {
          const first = data[0] as ApiConnection;
          setSelectedId(first.id);
          setMapping(buildDefaultMapping(first));
        }
      });
  }, [open, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleConnectionChange(id: string) {
    setSelectedId(id);
    setPreviewStep(false);
    setFetchError("");
    const conn = connections.find((c) => c.id === id);
    if (conn) setMapping(buildDefaultMapping(conn));
  }

  function updateMapping(key: keyof FieldMapping, value: string) {
    setMapping((prev) => ({ ...prev, [key]: value }));
  }

  const selectedConn = connections.find((c) => c.id === selectedId);

  async function handleFetch() {
    if (!selectedConn) return;
    setIsFetching(true);
    setFetchError("");
    setPreviewStep(false);
    try {
      const res = await fetch("/api/pl-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection: {
            base_url: selectedConn.base_url,
            api_key: selectedConn.api_key,
            type: selectedConn.type,
            field_mapping: mapping,
          },
          period_month: selectedMonth,
        }),
      });
      const data = await res.json() as { revenue?: number; publisher_cost?: number; error?: string };
      if (!res.ok) {
        setFetchError(data.error ?? "Lỗi không xác định từ API.");
        return;
      }
      // Convert to millions (assume API returns raw currency, divide by 1M)
      const revM = data.revenue ?? 0;
      const costM = data.publisher_cost ?? 0;
      setPreviewRevenue(String(revM));
      setPreviewCost(String(costM));
      setPreviewStep(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Không thể kết nối API.");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleSaveMapping() {
    if (!selectedConn) return;
    setIsSavingMapping(true);
    await supabase
      .from("api_connections")
      .update({ field_mapping: mapping })
      .eq("id", selectedConn.id);
    setIsSavingMapping(false);
    toast({ title: "Đã lưu cấu hình field mapping." });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const revenue = parseFloat(previewRevenue) || 0;
      const publisher_cost = parseFloat(previewCost) || 0;
      const period_month = `${selectedMonth}-01`;

      const payload = {
        company_id: companyId,
        period_month,
        revenue,
        publisher_cost,
        salary_cost: currentRecord?.salary_cost ?? 0,
        bonus_cost: currentRecord?.bonus_cost ?? 0,
        other_cost: currentRecord?.other_cost ?? 0,
        notes: currentRecord?.notes ?? null,
        updated_at: new Date().toISOString(),
      };

      let result: PLMonthlyRecord;
      if (currentRecord) {
        const { data, error } = await supabase
          .from("pl_monthly")
          .update(payload)
          .eq("id", currentRecord.id)
          .select()
          .single();
        if (error) throw error;
        result = data as PLMonthlyRecord;
      } else {
        const { data, error } = await supabase
          .from("pl_monthly")
          .upsert(payload, { onConflict: "company_id,period_month" })
          .select()
          .single();
        if (error) throw error;
        result = data as PLMonthlyRecord;
      }
      toast({ title: "Đã lưu dữ liệu P&L từ API thành công." });
      onSuccess(result);
      onClose();
    } catch (err) {
      toast({
        title: "Lỗi khi lưu",
        description: err instanceof Error ? err.message : "Lỗi không xác định.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const monthLabel = (() => {
    const [y, m] = selectedMonth.split("-");
    return `Tháng ${m}/${y}`;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Đồng bộ dữ liệu từ API</DialogTitle>
          <DialogDescription>
            Lấy doanh thu và chi phí Publisher từ hệ thống tracking cho {monthLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {connections.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-gray-400" />
              Chưa có kết nối API nào.{" "}
              <a href="/traffic" className="text-blue-600 underline">
                Cấu hình trong Traffic Monitor
              </a>{" "}
              trước.
            </div>
          ) : (
            <>
              {/* Connection selector */}
              <div className="space-y-1.5">
                <Label>Kết nối API</Label>
                <Select value={selectedId} onValueChange={handleConnectionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kết nối..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{" "}
                        <span className="text-xs text-gray-400">({c.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedConn && (
                  <p className="text-xs text-gray-400">
                    {selectedConn.base_url}
                  </p>
                )}
              </div>

              {/* Field mapping toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMapping((v) => !v)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {showMapping ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Cấu hình field mapping
                </button>

                {showMapping && (
                  <div className="mt-3 space-y-3 rounded-lg border bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Endpoint</Label>
                        <Input
                          value={mapping.endpoint}
                          onChange={(e) => updateMapping("endpoint", e.target.value)}
                          placeholder="/api/Affiliate/getStats"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Auth</Label>
                        <Select
                          value={mapping.auth_in}
                          onValueChange={(v) => updateMapping("auth_in", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="query">Query param</SelectItem>
                            <SelectItem value="header">Bearer header</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {mapping.auth_in === "query" && (
                        <div className="space-y-1">
                          <Label className="text-xs">Tên param API key</Label>
                          <Input
                            value={mapping.auth_param_name}
                            onChange={(e) => updateMapping("auth_param_name", e.target.value)}
                            placeholder="api_key"
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Param ngày bắt đầu</Label>
                        <Input
                          value={mapping.date_start_param}
                          onChange={(e) => updateMapping("date_start_param", e.target.value)}
                          placeholder="data_start"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Param ngày kết thúc</Label>
                        <Input
                          value={mapping.date_end_param}
                          onChange={(e) => updateMapping("date_end_param", e.target.value)}
                          placeholder="data_end"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Params bổ sung (query string)</Label>
                        <Input
                          value={mapping.extra_params}
                          onChange={(e) => updateMapping("extra_params", e.target.value)}
                          placeholder="Method=getStats"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">JSON path → Revenue</Label>
                        <Input
                          value={mapping.revenue_path}
                          onChange={(e) => updateMapping("revenue_path", e.target.value)}
                          placeholder="data.totals.revenue"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">JSON path → Publisher cost</Label>
                        <Input
                          value={mapping.cost_path}
                          onChange={(e) => updateMapping("cost_path", e.target.value)}
                          placeholder="data.totals.publisher_revenue"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveMapping}
                      disabled={isSavingMapping}
                    >
                      {isSavingMapping && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Lưu cấu hình này
                    </Button>
                  </div>
                )}
              </div>

              {/* Fetch button */}
              <Button
                onClick={handleFetch}
                disabled={!selectedId || isFetching}
                className="w-full"
              >
                {isFetching ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lấy dữ liệu...</>
                ) : (
                  "Lấy dữ liệu từ API"
                )}
              </Button>

              {/* Error */}
              {fetchError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{fetchError}</span>
                </div>
              )}

              {/* Preview */}
              {previewStep && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Dữ liệu nhận được — kiểm tra và chỉnh nếu cần
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Doanh thu (M)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={previewRevenue}
                        onChange={(e) => setPreviewRevenue(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Chi phí Publisher (M)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={previewCost}
                        onChange={(e) => setPreviewCost(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Salary, bonus và chi phí khác giữ nguyên từ bản ghi hiện tại (nếu có).
                  </p>
                  <Button onClick={handleSave} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</>
                    ) : (
                      `Lưu vào P&L ${monthLabel}`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
