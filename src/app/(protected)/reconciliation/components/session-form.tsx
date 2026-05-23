"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Loader2 } from "lucide-react";

export interface ReconSession {
  id: string;
  company_id: string;
  advertiser_id: string | null;
  period_month: string; // YYYY-MM-DD (first day)
  status: "pending" | "matching" | "review" | "approved" | "paid";
  our_file_url: string | null;
  adv_file_url: string | null;
  match_rate: number | null;
  dispute_note: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  advertisers?: { id: string; name: string } | null;
}

interface Advertiser {
  id: string;
  name: string;
}

interface SessionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  advertisers: Advertiser[];
  onCreated: (session: ReconSession) => void;
}

// Generate last 13 months as options
function buildMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toISOString().split("T")[0]; // YYYY-MM-DD
    const label = `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

export function SessionForm({
  open,
  onOpenChange,
  companyId,
  advertisers,
  onCreated,
}: SessionFormProps) {
  const { toast } = useToast();
  const [advertiserId, setAdvertiserId] = React.useState("");
  const [periodMonth, setPeriodMonth] = React.useState(MONTH_OPTIONS[0].value);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAdvertiserId("");
      setPeriodMonth(MONTH_OPTIONS[0].value);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!advertiserId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn Advertiser", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recon_sessions")
        .insert({
          company_id: companyId,
          advertiser_id: advertiserId,
          period_month: periodMonth,
          status: "pending",
        })
        .select(`*, advertisers(id, name)`)
        .single();

      if (error) throw error;

      toast({ title: "Đã tạo phiên đối soát", description: `${MONTH_OPTIONS.find(m => m.value === periodMonth)?.label}` });
      onCreated(data as ReconSession);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể tạo phiên đối soát",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo phiên đối soát mới</DialogTitle>
          <DialogDescription>
            Chọn advertiser và tháng cần đối soát để bắt đầu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Advertiser *</Label>
            <Select value={advertiserId} onValueChange={setAdvertiserId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn advertiser..." />
              </SelectTrigger>
              <SelectContent>
                {advertisers.map((adv) => (
                  <SelectItem key={adv.id} value={adv.id}>
                    {adv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tháng đối soát *</Label>
            <Select value={periodMonth} onValueChange={setPeriodMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo phiên đối soát
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
