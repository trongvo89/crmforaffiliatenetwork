"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import type { ReconSession } from "./session-form";

export interface ReconRecord {
  id: string;
  session_id: string;
  match_status: "matched" | "our_only" | "adv_only" | "amount_mismatch";
  click_id: string | null;
  conversion_id: string | null;
  our_amount: number | null;
  adv_amount: number | null;
  transaction_date: string | null;
  publisher_id: string | null;
  dispute_note: string | null;
  raw_data: Record<string, unknown> | null;
}

const STATUS_CONFIG: Record<
  ReconRecord["match_status"],
  { label: string; badgeClass: string; rowClass: string }
> = {
  matched: {
    label: "Khớp",
    badgeClass: "bg-green-100 text-green-800",
    rowClass: "",
  },
  amount_mismatch: {
    label: "Lệch số tiền",
    badgeClass: "bg-amber-100 text-amber-800",
    rowClass: "bg-amber-50/30",
  },
  our_only: {
    label: "Chỉ phía ta",
    badgeClass: "bg-blue-100 text-blue-800",
    rowClass: "bg-blue-50/30",
  },
  adv_only: {
    label: "Chỉ phía ADV",
    badgeClass: "bg-red-100 text-red-700",
    rowClass: "bg-red-50/30",
  },
};

interface ReviewTableProps {
  session: ReconSession;
  initialRecords: ReconRecord[];
  onApproved: (updatedSession: ReconSession) => void;
  onPaid: (updatedSession: ReconSession) => void;
}

export function ReviewTable({
  session,
  initialRecords,
  onApproved,
  onPaid,
}: ReviewTableProps) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState<ReconRecord[]>(initialRecords);
  const [disputeNotes, setDisputeNotes] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    initialRecords.forEach((r) => {
      if (r.dispute_note) init[r.id] = r.dispute_note;
    });
    return init;
  });
  const [savingNote, setSavingNote] = React.useState<string | null>(null);
  const [approving, setApproving] = React.useState(false);
  const [markingPaid, setMarkingPaid] = React.useState(false);
  const [filter, setFilter] = React.useState<ReconRecord["match_status"] | "all">("all");

  // Sync when records change (e.g. after re-run)
  React.useEffect(() => {
    setRecords(initialRecords);
    const init: Record<string, string> = {};
    initialRecords.forEach((r) => {
      if (r.dispute_note) init[r.id] = r.dispute_note;
    });
    setDisputeNotes(init);
  }, [initialRecords]);

  // Summary counts
  const counts = React.useMemo(() => {
    const c = { matched: 0, amount_mismatch: 0, our_only: 0, adv_only: 0 };
    records.forEach((r) => c[r.match_status]++);
    return c;
  }, [records]);

  const matchRate = records.length > 0 ? (counts.matched / records.length) * 100 : 0;

  const filteredRecords = filter === "all" ? records : records.filter((r) => r.match_status === filter);

  async function saveDisputeNote(recordId: string) {
    setSavingNote(recordId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("recon_records")
        .update({ dispute_note: disputeNotes[recordId] ?? null })
        .eq("id", recordId)
        .eq("session_id", session.id);

      if (error) throw error;
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, dispute_note: disputeNotes[recordId] ?? null } : r))
      );
      toast({ title: "Đã lưu ghi chú", description: "Ghi chú tranh chấp đã được cập nhật." });
    } catch (err: unknown) {
      toast({
        title: "Lỗi lưu ghi chú",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setSavingNote(null);
    }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { data: updatedSession, error } = await supabase
        .from("recon_sessions")
        .update({ status: "approved", approved_at: now, updated_at: now })
        .eq("id", session.id)
        .eq("company_id", session.company_id)
        .select(`*, advertisers(id, name)`)
        .single();

      if (error) throw error;

      // Create publisher contact log entries for publishers in this session
      const pubIdSet = new Set<string>();
      records.forEach((r) => { if (r.publisher_id) pubIdSet.add(r.publisher_id); });
      const publisherIds = Array.from(pubIdSet);
      if (publisherIds.length > 0) {
        const month = session.period_month.slice(0, 7); // YYYY-MM
        const [y, m] = month.split("-");
        const label = `T${m}/${y}`;
        await supabase.from("publisher_contact_log").insert(
          publisherIds.map((pid) => ({
            publisher_id: pid,
            event_type: "system",
            note: `Đối soát ${label} hoàn tất — ${session.advertisers?.name ?? "ADV"}`,
          }))
        );
      }

      toast({ title: "Đã phê duyệt", description: "Phiên đối soát đã được approve." });
      onApproved(updatedSession as ReconSession);
    } catch (err: unknown) {
      toast({
        title: "Lỗi approve",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  }

  async function handleMarkPaid() {
    setMarkingPaid(true);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      const { data: updatedSession, error } = await supabase
        .from("recon_sessions")
        .update({ status: "paid", paid_at: now, updated_at: now })
        .eq("id", session.id)
        .eq("company_id", session.company_id)
        .select(`*, advertisers(id, name)`)
        .single();

      if (error) throw error;
      toast({ title: "Đã đánh dấu đã thanh toán" });
      onPaid(updatedSession as ReconSession);
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setMarkingPaid(false);
    }
  }

  function exportCSV() {
    const headers = ["match_status", "click_id", "conversion_id", "our_amount", "adv_amount", "transaction_date", "dispute_note"];
    const rows = records.map((r) => [
      r.match_status,
      r.click_id ?? "",
      r.conversion_id ?? "",
      r.our_amount ?? "",
      r.adv_amount ?? "",
      r.transaction_date ?? "",
      r.dispute_note ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const month = session.period_month.slice(0, 7);
    a.download = `recon_${session.advertisers?.name ?? "adv"}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["matched", "amount_mismatch", "our_only", "adv_only"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(filter === status ? "all" : status)}
            className={cn(
              "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
              filter === status ? "ring-2 ring-blue-500" : "hover:border-gray-300"
            )}
          >
            <p className="text-xl font-bold">{counts[status]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className={cn("inline-block rounded-full px-1.5 py-0.5 font-medium", STATUS_CONFIG[status].badgeClass)}>
                {STATUS_CONFIG[status].label}
              </span>
            </p>
          </button>
        ))}
      </div>

      {/* Match rate + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          {matchRate >= 90 ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            Tỷ lệ khớp:{" "}
            <span className={cn("font-bold", matchRate >= 90 ? "text-green-600" : "text-amber-600")}>
              {matchRate.toFixed(1)}%
            </span>
          </span>
          <span className="text-sm text-muted-foreground">({counts.matched}/{records.length} bản ghi)</span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Xuất CSV
          </Button>

          {session.status === "review" && (
            <Button size="sm" onClick={handleApprove} disabled={approving}>
              {approving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Phê duyệt
            </Button>
          )}

          {session.status === "approved" && (
            <Button size="sm" onClick={handleMarkPaid} disabled={markingPaid}>
              {markingPaid && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Đánh dấu Đã thanh toán
            </Button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "matched", "amount_mismatch", "our_only", "adv_only"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {f === "all" ? `Tất cả (${records.length})` : `${STATUS_CONFIG[f].label} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Records table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-32">Trạng thái</TableHead>
              <TableHead>Click/Conv ID</TableHead>
              <TableHead className="text-right">Số tiền (ta)</TableHead>
              <TableHead className="text-right">Số tiền (ADV)</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead className="min-w-[200px]">Ghi chú tranh chấp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Không có bản ghi nào
                </TableCell>
              </TableRow>
            )}
            {filteredRecords.map((record) => {
              const cfg = STATUS_CONFIG[record.match_status];
              const needsNote = record.match_status !== "matched";
              return (
                <TableRow key={record.id} className={cfg.rowClass}>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", cfg.badgeClass)}>
                      {cfg.label}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.click_id ?? record.conversion_id ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {record.our_amount != null ? formatCurrency(record.our_amount) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {record.adv_amount != null ? (
                      <span className={cn(
                        record.match_status === "amount_mismatch" && record.our_amount != null
                          ? "text-amber-600 font-medium"
                          : ""
                      )}>
                        {formatCurrency(record.adv_amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.transaction_date ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {needsNote && session.status !== "paid" ? (
                      <div className="flex items-start gap-1.5">
                        <Textarea
                          rows={1}
                          value={disputeNotes[record.id] ?? ""}
                          onChange={(e) =>
                            setDisputeNotes((prev) => ({ ...prev, [record.id]: e.target.value }))
                          }
                          placeholder="Thêm ghi chú tranh chấp..."
                          className="resize-none text-xs min-h-0 py-1.5"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() => saveDisputeNote(record.id)}
                          disabled={savingNote === record.id}
                        >
                          {savingNote === record.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Lưu"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {record.dispute_note ?? "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
