"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Brain,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ContractForm } from "./components/contract-form";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contract {
  id: string;
  company_id: string;
  party_name: string;
  party_type: "publisher" | "advertiser" | "other";
  file_url: string | null;
  signed_date: string | null;
  expiry_date: string | null;
  ai_analysis: {
    summary?: string;
    key_terms?: string[];
    risks?: string[];
    recommendations?: string[];
    analyzed_at?: string;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type ContractStatus = "active" | "expiring" | "expired";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(expiryDate: string | null): ContractStatus {
  if (!expiryDate) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) return "expired";

  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  if (expiry <= thirtyDays) return "expiring";

  return "active";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContractStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Còn hiệu lực
      </span>
    );
  }
  if (status === "expiring") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        <Clock className="h-3 w-3" />
        Sắp hết hạn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
      <AlertCircle className="h-3 w-3" />
      Đã hết hạn
    </span>
  );
}

// ─── Party Type Badge ─────────────────────────────────────────────────────────

const PARTY_TYPE_MAP: Record<
  Contract["party_type"],
  { label: string; className: string }
> = {
  publisher: {
    label: "Publisher",
    className: "bg-blue-100 text-blue-700",
  },
  advertiser: {
    label: "Advertiser",
    className: "bg-green-100 text-green-700",
  },
  other: {
    label: "Khác",
    className: "bg-gray-100 text-gray-600",
  },
};

function PartyTypeBadge({ type }: { type: Contract["party_type"] }) {
  const { label, className } = PARTY_TYPE_MAP[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
    >
      {label}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContractsClientProps {
  initialContracts: Contract[];
  companyId: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContractsClient({
  initialContracts,
  companyId,
}: ContractsClientProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const [contracts, setContracts] = React.useState<Contract[]>(initialContracts);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingContract, setEditingContract] = React.useState<Contract | null>(null);
  const [analyzingId, setAnalyzingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // ── Status counts ─────────────────────────────────────────────────────────

  const counts = React.useMemo(() => {
    return contracts.reduce(
      (acc, c) => {
        const s = getStatus(c.expiry_date);
        acc[s] += 1;
        return acc;
      },
      { active: 0, expiring: 0, expired: 0 }
    );
  }, [contracts]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAdd() {
    setEditingContract(null);
    setFormOpen(true);
  }

  function handleEdit(contract: Contract) {
    setEditingContract(contract);
    setFormOpen(true);
  }

  function handleSaved(saved: Contract) {
    setContracts((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
  }

  async function handleDelete(contract: Contract) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa hợp đồng với "${contract.party_name}"?`
    );
    if (!confirmed) return;

    setDeletingId(contract.id);
    try {
      const { error } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contract.id)
        .eq("company_id", companyId);

      if (error) throw error;

      setContracts((prev) => prev.filter((c) => c.id !== contract.id));
      toast({ title: "Đã xóa hợp đồng" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Xóa thất bại",
        description: "Có lỗi xảy ra khi xóa hợp đồng.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAnalyze(contract: Contract) {
    if (!contract.file_url) return;
    setAnalyzingId(contract.id);
    try {
      const res = await fetch("/api/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: contract.id,
          companyId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Lỗi phân tích");
      }

      const { contract: updated } = await res.json();
      setContracts((prev) =>
        prev.map((c) => (c.id === updated.id ? (updated as Contract) : c))
      );
      toast({ title: "Phân tích AI hoàn tất" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Phân tích thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingId(null);
    }
  }

  // ── No company ────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Hợp đồng</h1>
        <div className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50">
          <div className="text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-amber-400" />
            <p className="font-medium text-amber-800">Chưa cấu hình công ty</p>
            <p className="mt-1 text-sm text-amber-600">
              Vui lòng thiết lập thông tin công ty trong mục Cài đặt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hợp đồng</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý hợp đồng với publisher và advertiser
          </p>
        </div>
        <Button onClick={handleAdd} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Thêm hợp đồng
        </Button>
      </div>

      {/* Count chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-gray-700">Còn hiệu lực</span>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            {counts.active}
          </Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 shadow-sm">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Sắp hết hạn</span>
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            {counts.expiring}
          </Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 shadow-sm">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-gray-700">Đã hết hạn</span>
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            {counts.expired}
          </Badge>
        </div>
      </div>

      {/* Contract list */}
      {contracts.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <FileText className="mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-500">Chưa có hợp đồng nào</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleAdd}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Thêm hợp đồng đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => {
            const status = getStatus(contract.expiry_date);
            const isAnalyzing = analyzingId === contract.id;
            const isDeleting = deletingId === contract.id;

            return (
              <div
                key={contract.id}
                className="rounded-xl border bg-white p-5 shadow-sm"
              >
                {/* Card header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {contract.party_name}
                    </h3>
                    <PartyTypeBadge type={contract.party_type} />
                    <StatusBadge status={status} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {contract.file_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={isAnalyzing}
                        onClick={() => handleAnalyze(contract)}
                      >
                        {isAnalyzing ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Brain className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isAnalyzing ? "Đang phân tích..." : "Phân tích AI"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleEdit(contract)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={isDeleting}
                      onClick={() => handleDelete(contract)}
                    >
                      {isDeleting ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      Xóa
                    </Button>
                  </div>
                </div>

                {/* Dates */}
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>
                    <span className="font-medium text-gray-500">Ký ngày:</span>{" "}
                    {formatDate(contract.signed_date)}
                  </span>
                  <span>
                    <span className="font-medium text-gray-500">Hết hạn:</span>{" "}
                    {formatDate(contract.expiry_date)}
                  </span>
                  {contract.file_url && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <FileText className="h-3.5 w-3.5" />
                      Có tệp đính kèm
                    </span>
                  )}
                </div>

                {/* Notes */}
                {contract.notes && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                    {contract.notes}
                  </p>
                )}

                {/* AI Analysis */}
                {contract.ai_analysis && (
                  <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-4">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Brain className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-700">
                        Phân tích AI
                      </span>
                      {contract.ai_analysis.analyzed_at && (
                        <span className="ml-auto text-xs text-purple-400">
                          {new Date(
                            contract.ai_analysis.analyzed_at
                          ).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </div>

                    {contract.ai_analysis.summary && (
                      <p className="text-sm text-purple-800">
                        {contract.ai_analysis.summary}
                      </p>
                    )}

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {contract.ai_analysis.key_terms &&
                        contract.ai_analysis.key_terms.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-600">
                              Điều khoản chính
                            </p>
                            <ul className="space-y-0.5">
                              {contract.ai_analysis.key_terms
                                .slice(0, 3)
                                .map((term, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-purple-700"
                                  >
                                    • {term}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}

                      {contract.ai_analysis.risks &&
                        contract.ai_analysis.risks.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-500">
                              Rủi ro
                            </p>
                            <ul className="space-y-0.5">
                              {contract.ai_analysis.risks
                                .slice(0, 3)
                                .map((risk, i) => (
                                  <li key={i} className="text-xs text-red-700">
                                    • {risk}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}

                      {contract.ai_analysis.recommendations &&
                        contract.ai_analysis.recommendations.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                              Khuyến nghị
                            </p>
                            <ul className="space-y-0.5">
                              {contract.ai_analysis.recommendations
                                .slice(0, 3)
                                .map((rec, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-green-700"
                                  >
                                    • {rec}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <ContractForm
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        contract={editingContract}
        onSaved={handleSaved}
      />
    </div>
  );
}
