"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type OfferModel = "CPA" | "CPL" | "CPS" | "CPI" | "RevShare";
export type OfferStatus = "active" | "paused" | "ended";

export interface Offer {
  id: string;
  advertiser_id: string;
  name: string;
  model: OfferModel;
  payout: number;
  geo: string[];
  status: OfferStatus;
  budget_total: number | null;
  budget_spent: number;
  created_at: string;
  updated_at: string;
}

interface OfferFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer?: Offer | null;
  advertiserId: string;
  advertiserName: string;
  onSaved: (offer: Offer) => void;
}

interface FormState {
  name: string;
  model: OfferModel | "";
  payout: string;
  geo: string;
  budget_total: string;
  status: OfferStatus;
}

const defaultForm: FormState = {
  name: "",
  model: "",
  payout: "",
  geo: "",
  budget_total: "",
  status: "active",
};

const OFFER_MODELS: OfferModel[] = ["CPA", "CPL", "CPS", "CPI", "RevShare"];
const OFFER_STATUSES: { value: OfferStatus; label: string }[] = [
  { value: "active", label: "Đang chạy" },
  { value: "paused", label: "Tạm dừng" },
  { value: "ended", label: "Đã kết thúc" },
];

export function OfferForm({
  open,
  onOpenChange,
  offer,
  advertiserId,
  advertiserName,
  onSaved,
}: OfferFormProps) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState>(defaultForm);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});

  const isEditing = !!offer;

  React.useEffect(() => {
    if (open) {
      if (offer) {
        setForm({
          name: offer.name,
          model: offer.model,
          payout: String(offer.payout),
          geo: offer.geo ? offer.geo.join(", ") : "",
          budget_total: offer.budget_total != null ? String(offer.budget_total) : "",
          status: offer.status,
        });
      } else {
        setForm(defaultForm);
      }
      setErrors({});
    }
  }, [open, offer]);

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = "Tên offer là bắt buộc";
    }
    if (!form.model) {
      newErrors.model = "Model là bắt buộc";
    }
    const payout = Number(form.payout);
    if (!form.payout || isNaN(payout) || payout < 0) {
      newErrors.payout = "Payout phải là số không âm";
    }
    if (form.budget_total) {
      const bt = Number(form.budget_total);
      if (isNaN(bt) || bt < 0) {
        newErrors.budget_total = "Budget phải là số không âm";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const supabase = createClient();

      // Parse geo: split by comma, trim, filter empty
      const geoArray = form.geo
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      const payload = {
        advertiser_id: advertiserId,
        name: form.name.trim(),
        model: form.model as OfferModel,
        payout: Number(form.payout),
        geo: geoArray,
        status: form.status,
        budget_total: form.budget_total ? Number(form.budget_total) : null,
        updated_at: new Date().toISOString(),
      };

      let result: Offer;

      if (isEditing && offer) {
        const { data, error } = await supabase
          .from("offers")
          .update(payload)
          .eq("id", offer.id)
          .select()
          .single();

        if (error) throw error;
        result = data as Offer;
      } else {
        const { data, error } = await supabase
          .from("offers")
          .insert({ ...payload, budget_spent: 0, created_at: new Date().toISOString() })
          .select()
          .single();

        if (error) throw error;
        result = data as Offer;
      }

      toast({
        title: isEditing ? "Đã cập nhật offer" : "Đã thêm offer",
        description: `"${result.name}" đã được ${isEditing ? "cập nhật" : "tạo"} thành công.`,
      });
      onSaved(result);
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi";
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Chỉnh sửa Offer" : "Thêm Offer mới"}
          </DialogTitle>
          <DialogDescription>
            Advertiser: <span className="font-medium text-foreground">{advertiserName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tên offer */}
          <div className="space-y-1.5">
            <Label htmlFor="offer-name">
              Tên offer <span className="text-red-500">*</span>
            </Label>
            <Input
              id="offer-name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="VD: Shopee CPA Vietnam"
              disabled={loading}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Model + Payout row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-model">
                Model <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.model}
                onValueChange={(v) => handleChange("model", v)}
                disabled={loading}
              >
                <SelectTrigger id="offer-model">
                  <SelectValue placeholder="Chọn model" />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.model && <p className="text-xs text-red-500">{errors.model}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="offer-payout">
                Payout <span className="text-red-500">*</span>{" "}
                <span className="text-muted-foreground font-normal">(VND/conversion)</span>
              </Label>
              <Input
                id="offer-payout"
                type="number"
                min="0"
                step="1000"
                value={form.payout}
                onChange={(e) => handleChange("payout", e.target.value)}
                placeholder="50000"
                disabled={loading}
              />
              {errors.payout && <p className="text-xs text-red-500">{errors.payout}</p>}
            </div>
          </div>

          {/* Geo */}
          <div className="space-y-1.5">
            <Label htmlFor="offer-geo">
              Geo{" "}
              <span className="text-muted-foreground font-normal">(phân cách bằng dấu phẩy)</span>
            </Label>
            <Input
              id="offer-geo"
              value={form.geo}
              onChange={(e) => handleChange("geo", e.target.value)}
              placeholder="VN, TH, PH"
              disabled={loading}
            />
          </div>

          {/* Budget total */}
          <div className="space-y-1.5">
            <Label htmlFor="offer-budget">
              Budget tổng{" "}
              <span className="text-muted-foreground font-normal">(VND, để trống nếu không giới hạn)</span>
            </Label>
            <Input
              id="offer-budget"
              type="number"
              min="0"
              step="1000000"
              value={form.budget_total}
              onChange={(e) => handleChange("budget_total", e.target.value)}
              placeholder="100000000"
              disabled={loading}
            />
            {errors.budget_total && (
              <p className="text-xs text-red-500">{errors.budget_total}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="offer-status">Trạng thái</Label>
            <Select
              value={form.status}
              onValueChange={(v) => handleChange("status", v)}
              disabled={loading}
            >
              <SelectTrigger id="offer-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Lưu thay đổi" : "Thêm Offer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
