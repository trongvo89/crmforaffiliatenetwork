"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { UploadStep } from "./upload-step";
import { ReviewTable, type ReconRecord } from "./review-table";
import type { ReconSession } from "./session-form";

const STATUS_LABELS: Record<ReconSession["status"], string> = {
  pending: "Chờ upload",
  matching: "Đang xử lý",
  review: "Đang review",
  approved: "Đã phê duyệt",
  paid: "Đã thanh toán",
};

const STATUS_VARIANTS: Record<ReconSession["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  matching: "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-violet-100 text-violet-700",
};

interface SessionDetailProps {
  session: ReconSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionUpdate: (session: ReconSession) => void;
}

function formatPeriod(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `Tháng ${m}/${y}`;
}

export function SessionDetail({
  session,
  open,
  onOpenChange,
  onSessionUpdate,
}: SessionDetailProps) {
  const [records, setRecords] = React.useState<ReconRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = React.useState(false);

  // Load records when session enters review/approved/paid
  React.useEffect(() => {
    if (!session || !open) return;
    if (!["review", "approved", "paid"].includes(session.status)) {
      setRecords([]);
      return;
    }

    let cancelled = false;
    setLoadingRecords(true);
    const supabase = createClient();
    supabase
      .from("recon_records")
      .select("*")
      .eq("session_id", session.id)
      .order("match_status", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setRecords((data as ReconRecord[]) ?? []);
        setLoadingRecords(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status, open]);

  if (!session) return null;

  function handleMatchComplete(updated: ReconSession) {
    onSessionUpdate(updated);
    // Trigger record reload by updating session (status changed to review)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="text-xl">
                Phiên đối soát — {session.advertisers?.name ?? "—"}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-2">
                  <span>{formatPeriod(session.period_month)}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_VARIANTS[session.status]}`}
                  >
                    {STATUS_LABELS[session.status]}
                  </span>
                  {session.match_rate != null && (
                    <span className="text-xs text-muted-foreground">
                      Tỷ lệ khớp: <strong>{session.match_rate.toFixed(1)}%</strong>
                    </span>
                  )}
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content based on status */}
        {session.status === "pending" && (
          <UploadStep session={session} onMatchComplete={handleMatchComplete} />
        )}

        {session.status === "matching" && (
          <div className="flex h-40 items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Đang xử lý dữ liệu...</span>
          </div>
        )}

        {["review", "approved", "paid"].includes(session.status) && (
          <>
            {loadingRecords ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ReviewTable
                session={session}
                initialRecords={records}
                onApproved={(updated) => {
                  onSessionUpdate(updated);
                }}
                onPaid={(updated) => {
                  onSessionUpdate(updated);
                }}
              />
            )}
          </>
        )}

        {/* Timestamps */}
        <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span>Tạo: {new Date(session.created_at).toLocaleString("vi-VN")}</span>
          {session.approved_at && (
            <span>Phê duyệt: {new Date(session.approved_at).toLocaleString("vi-VN")}</span>
          )}
          {session.paid_at && (
            <span>Thanh toán: {new Date(session.paid_at).toLocaleString("vi-VN")}</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
