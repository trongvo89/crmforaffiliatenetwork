"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, FileSearch, ChevronRight } from "lucide-react";
import { SessionForm, type ReconSession } from "./components/session-form";
import { SessionDetail } from "./components/session-detail";

interface Advertiser {
  id: string;
  name: string;
}

interface ReconciliationClientProps {
  initialSessions: ReconSession[];
  advertisers: Advertiser[];
  companyId: string;
}

const STATUS_LABELS: Record<ReconSession["status"], string> = {
  pending: "Chờ upload",
  matching: "Đang xử lý",
  review: "Đang review",
  approved: "Đã phê duyệt",
  paid: "Đã thanh toán",
};

const STATUS_STYLES: Record<ReconSession["status"], string> = {
  pending: "bg-gray-100 text-gray-600 border-gray-200",
  matching: "bg-blue-100 text-blue-700 border-blue-200",
  review: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  paid: "bg-violet-100 text-violet-700 border-violet-200",
};

const STATUS_ORDER: Record<ReconSession["status"], number> = {
  pending: 0,
  matching: 1,
  review: 2,
  approved: 3,
  paid: 4,
};

function formatPeriod(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `T${m}/${y}`;
}

function SessionCard({
  session,
  onClick,
}: {
  session: ReconSession;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                STATUS_STYLES[session.status]
              )}
            >
              {STATUS_LABELS[session.status]}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {formatPeriod(session.period_month)}
            </span>
          </div>
          <p className="text-base font-medium text-gray-900 truncate">
            {session.advertisers?.name ?? "—"}
          </p>
          {session.match_rate != null && (
            <p className="text-sm text-muted-foreground">
              Tỷ lệ khớp:{" "}
              <span
                className={cn(
                  "font-semibold",
                  session.match_rate >= 90 ? "text-green-600" : "text-amber-600"
                )}
              >
                {session.match_rate.toFixed(1)}%
              </span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(session.created_at).toLocaleDateString("vi-VN")}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
      </div>

      {/* Status progress bar */}
      <div className="mt-3 flex gap-1">
        {(["pending", "matching", "review", "approved", "paid"] as const).map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              STATUS_ORDER[session.status] >= STATUS_ORDER[s] ? "bg-blue-500" : "bg-gray-200"
            )}
          />
        ))}
      </div>
    </button>
  );
}

export function ReconciliationClient({
  initialSessions,
  advertisers,
  companyId,
}: ReconciliationClientProps) {
  const [sessions, setSessions] = React.useState<ReconSession[]>(initialSessions);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState<ReconSession | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Sort: active first (pending/matching/review), then approved, then paid; within group newest first
  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => {
      const activeA = ["pending", "matching", "review"].includes(a.status);
      const activeB = ["pending", "matching", "review"].includes(b.status);
      if (activeA !== activeB) return activeA ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [sessions]);

  function handleCreated(session: ReconSession) {
    setSessions((prev) => [session, ...prev]);
    setSelectedSession(session);
    setDetailOpen(true);
  }

  function handleSessionUpdate(updated: ReconSession) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedSession(updated);
  }

  function openDetail(session: ReconSession) {
    setSelectedSession(session);
    setDetailOpen(true);
  }

  const pendingCount = sessions.filter((s) => ["pending", "matching", "review"].includes(s.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đối soát</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý và đối soát dữ liệu với advertiser
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo phiên đối soát
        </Button>
      </div>

      {/* Active sessions alert */}
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{pendingCount}</strong> phiên đối soát đang chờ xử lý
        </div>
      )}

      {/* Sessions grid */}
      {sortedSessions.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200">
          <FileSearch className="h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-500">Chưa có phiên đối soát nào</p>
          <p className="text-sm text-gray-400">Tạo phiên đầu tiên để bắt đầu</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tạo phiên đối soát
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onClick={() => openDetail(session)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <SessionForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
        advertisers={advertisers}
        onCreated={handleCreated}
      />

      <SessionDetail
        session={selectedSession}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSessionUpdate={handleSessionUpdate}
      />
    </div>
  );
}
