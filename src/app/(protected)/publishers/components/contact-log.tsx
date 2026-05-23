"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Settings, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type ContactLogEntry = {
  id: string;
  publisher_id: string;
  event_type: "system" | "manual";
  note: string;
  created_at: string;
  created_by: string | null;
};

interface ContactLogProps {
  publisherId: string;
  initialEntries: ContactLogEntry[];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactLog({ publisherId, initialEntries }: ContactLogProps) {
  const { toast } = useToast();
  const [entries, setEntries] = React.useState<ContactLogEntry[]>(initialEntries);
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;

    setIsSaving(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("publisher_contact_log")
        .insert({
          publisher_id: publisherId,
          event_type: "manual",
          note: trimmed,
        })
        .select()
        .single();

      if (error) throw error;

      setEntries((prev) => [data as ContactLogEntry, ...prev]);
      setNote("");
      toast({
        title: "Đã thêm ghi chú",
        description: "Ghi chú của bạn đã được lưu vào nhật ký.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Không thể lưu ghi chú.";
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form onSubmit={handleAddNote} className="space-y-2">
        <Textarea
          placeholder="Thêm ghi chú về publisher này..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          disabled={isSaving}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || !note.trim()}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Lưu ghi chú
          </Button>
        </div>
      </form>

      {/* Timeline */}
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có hoạt động nào được ghi nhận.
        </p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-0 h-full w-px bg-gray-200" aria-hidden="true" />

          <ul className="space-y-4">
            {entries.map((entry, index) => {
              const isSystem = entry.event_type === "system";
              return (
                <li key={entry.id} className="relative flex gap-3 pl-8">
                  {/* Dot indicator */}
                  <span
                    className={cn(
                      "absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white",
                      isSystem
                        ? "border-blue-300 text-blue-600"
                        : "border-gray-300 text-gray-500"
                    )}
                    aria-hidden="true"
                  >
                    {isSystem ? (
                      <Settings className="h-3.5 w-3.5" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                  </span>

                  {/* Content */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2.5 text-sm",
                      isSystem
                        ? "border-blue-100 bg-blue-50"
                        : "border-gray-100 bg-gray-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium uppercase tracking-wide",
                          isSystem ? "text-blue-600" : "text-gray-500"
                        )}
                      >
                        {isSystem ? "Hệ thống" : "Ghi chú thủ công"}
                      </span>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={entry.created_at}
                      >
                        {formatDateTime(entry.created_at)}
                      </time>
                    </div>
                    <p className={cn("mt-1", isSystem ? "text-blue-800" : "text-gray-700")}>
                      {entry.note}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
