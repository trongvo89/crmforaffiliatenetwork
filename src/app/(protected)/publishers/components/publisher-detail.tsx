"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContactLog, type ContactLogEntry } from "./contact-log";
import type { Publisher } from "./publisher-form";
import {
  Mail,
  CreditCard,
  Building2,
  FileText,
  Wifi,
  Loader2,
} from "lucide-react";

const TIER_COLORS: Record<Publisher["tier"], string> = {
  Platinum: "bg-violet-100 text-violet-800",
  Gold: "bg-amber-100 text-amber-800",
  Silver: "bg-slate-100 text-slate-700",
  Bronze: "bg-orange-100 text-orange-800",
};

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  native: "Native",
  email: "Email",
  push: "Push",
  seo: "SEO",
  other: "Khác",
};

function TierBadge({ tier }: { tier: Publisher["tier"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TIER_COLORS[tier]
      )}
    >
      {tier}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isActive
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-green-500" : "bg-gray-400"
        )}
      />
      {isActive ? "Đang hoạt động" : "Không hoạt động"}
    </span>
  );
}

interface PublisherDetailProps {
  publisher: Publisher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (publisher: Publisher) => void;
}

export function PublisherDetail({
  publisher,
  open,
  onOpenChange,
  onEdit,
}: PublisherDetailProps) {
  const [logEntries, setLogEntries] = React.useState<ContactLogEntry[]>([]);
  const [isLoadingLog, setIsLoadingLog] = React.useState(false);
  const [logError, setLogError] = React.useState<string | null>(null);

  // Fetch contact log when publisher changes and dialog is open
  React.useEffect(() => {
    if (!publisher || !open) return;

    let cancelled = false;
    setIsLoadingLog(true);
    setLogError(null);
    setLogEntries([]);

    const supabase = createClient();
    supabase
      .from("publisher_contact_log")
      .select("*")
      .eq("publisher_id", publisher.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLogError("Không thể tải nhật ký hoạt động.");
        } else {
          setLogEntries((data as ContactLogEntry[]) ?? []);
        }
        setIsLoadingLog(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisher?.id, open]);

  if (!publisher) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="space-y-1.5">
              <DialogTitle className="text-xl">{publisher.name}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <TierBadge tier={publisher.tier} />
                  <StatusBadge isActive={publisher.is_active} />
                </div>
              </DialogDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                onOpenChange(false);
                onEdit(publisher);
              }}
            >
              Chỉnh sửa
            </Button>
          </div>
        </DialogHeader>

        {/* Publisher info section */}
        <div className="space-y-3">
          {/* Email */}
          {publisher.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <a
                href={`mailto:${publisher.email}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {publisher.email}
              </a>
            </div>
          )}

          {/* Traffic Sources */}
          {publisher.traffic_sources && publisher.traffic_sources.length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Traffic:</span>
              <div className="flex flex-wrap gap-1.5">
                {publisher.traffic_sources.map((src) => (
                  <span
                    key={src}
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700"
                  >
                    {TRAFFIC_SOURCE_LABELS[src] ?? src}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method */}
          {publisher.payment_method && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Thanh toán:</span>
              <span className="font-medium">{publisher.payment_method}</span>
            </div>
          )}

          {/* Bank Info */}
          {publisher.bank_info && (
            <div className="flex items-start gap-2 text-sm">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Ngân hàng:</span>
              <BankInfoDisplay raw={publisher.bank_info} />
            </div>
          )}

          {/* Notes */}
          {publisher.notes && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Ghi chú:</span>
              <p className="whitespace-pre-wrap text-gray-700">{publisher.notes}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Contact Log section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Nhật ký hoạt động
          </h3>

          {isLoadingLog ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logError ? (
            <p className="text-sm text-red-500">{logError}</p>
          ) : (
            <ContactLog
              publisherId={publisher.id}
              initialEntries={logEntries}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Toggleable masked/unmasked bank info
function BankInfoDisplay({ raw }: { raw: string }) {
  const [revealed, setRevealed] = React.useState(false);

  function maskBankInfo(info: string): string {
    return info
      .split("\n")
      .map((line) => {
        const stripped = line.trim();
        if (stripped.length <= 4) return stripped;
        return "•".repeat(Math.min(stripped.length - 4, 8)) + stripped.slice(-4);
      })
      .join("\n");
  }

  return (
    <div className="flex items-start gap-2">
      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
        {revealed ? raw : maskBankInfo(raw)}
      </pre>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="shrink-0 text-xs text-blue-500 hover:text-blue-700 hover:underline"
      >
        {revealed ? "Ẩn" : "Hiện"}
      </button>
    </div>
  );
}
