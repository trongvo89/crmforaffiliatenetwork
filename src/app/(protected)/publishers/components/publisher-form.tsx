"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { Loader2 } from "lucide-react";

export type Publisher = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  tier: "Platinum" | "Gold" | "Silver" | "Bronze";
  traffic_sources: string[];
  payment_method: string | null;
  bank_info: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TRAFFIC_SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "native", label: "Native" },
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "seo", label: "SEO" },
  { value: "other", label: "Khác" },
] as const;

const TIERS = ["Platinum", "Gold", "Silver", "Bronze"] as const;

type FormState = {
  name: string;
  email: string;
  tier: Publisher["tier"];
  traffic_sources: string[];
  payment_method: string;
  bank_info: string;
  notes: string;
  is_active: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  tier: "Bronze",
  traffic_sources: [],
  payment_method: "",
  bank_info: "",
  notes: "",
  is_active: true,
};

interface PublisherFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publisher?: Publisher | null;
  companyId: string;
  onSuccess: (publisher: Publisher) => void;
}

export function PublisherForm({
  open,
  onOpenChange,
  publisher,
  companyId,
  onSuccess,
}: PublisherFormProps) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});

  const isEditing = !!publisher;

  // Sync form when publisher changes or dialog opens
  React.useEffect(() => {
    if (open) {
      if (publisher) {
        setForm({
          name: publisher.name,
          email: publisher.email ?? "",
          tier: publisher.tier,
          traffic_sources: publisher.traffic_sources ?? [],
          payment_method: publisher.payment_method ?? "",
          bank_info: publisher.bank_info ?? "",
          notes: publisher.notes ?? "",
          is_active: publisher.is_active,
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [open, publisher]);

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = "Tên publisher là bắt buộc";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Email không hợp lệ";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function toggleTrafficSource(source: string) {
    setForm((prev) => ({
      ...prev,
      traffic_sources: prev.traffic_sources.includes(source)
        ? prev.traffic_sources.filter((s) => s !== source)
        : [...prev.traffic_sources, source],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        tier: form.tier,
        traffic_sources: form.traffic_sources,
        payment_method: form.payment_method.trim() || null,
        bank_info: form.bank_info.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (isEditing && publisher) {
        const { data, error } = await supabase
          .from("publishers")
          .update(payload)
          .eq("id", publisher.id)
          .select()
          .single();

        if (error) throw error;

        // Log tier change if tier changed
        if (publisher.tier !== form.tier) {
          await supabase.from("publisher_contact_log").insert({
            publisher_id: publisher.id,
            event_type: "system",
            note: `Tier đã thay đổi từ ${publisher.tier} sang ${form.tier}`,
          });
        }

        toast({
          title: "Cập nhật thành công",
          description: `Publisher "${data.name}" đã được cập nhật.`,
        });
        onSuccess(data as Publisher);
      } else {
        const { data, error } = await supabase
          .from("publishers")
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select()
          .single();

        if (error) throw error;

        // System log entry for new publisher
        await supabase.from("publisher_contact_log").insert({
          publisher_id: data.id,
          event_type: "system",
          note: "Publisher được thêm vào hệ thống",
        });

        toast({
          title: "Thêm thành công",
          description: `Publisher "${data.name}" đã được thêm vào hệ thống.`,
        });
        onSuccess(data as Publisher);
      }

      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Đã xảy ra lỗi, vui lòng thử lại.";
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Chỉnh sửa Publisher" : "Thêm Publisher mới"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cập nhật thông tin publisher trong hệ thống."
              : "Điền thông tin để thêm publisher mới vào hệ thống."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-name">
              Tên Publisher <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pub-name"
              placeholder="Nhập tên publisher..."
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={cn(errors.name && "border-red-400")}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-email">Email</Label>
            <Input
              id="pub-email"
              type="email"
              placeholder="publisher@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className={cn(errors.email && "border-red-400")}
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Tier */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-tier">Tier</Label>
            <Select
              value={form.tier}
              onValueChange={(val) =>
                setForm((p) => ({ ...p, tier: val as Publisher["tier"] }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="pub-tier">
                <SelectValue placeholder="Chọn tier..." />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Traffic Sources */}
          <div className="space-y-2">
            <Label>Traffic Sources</Label>
            <div className="flex flex-wrap gap-3">
              {TRAFFIC_SOURCES.map((source) => {
                const checked = form.traffic_sources.includes(source.value);
                return (
                  <label
                    key={source.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                      isSubmitting && "pointer-events-none opacity-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleTrafficSource(source.value)}
                      disabled={isSubmitting}
                    />
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        checked
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-gray-300"
                      )}
                    >
                      {checked && (
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    {source.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-payment">Phương thức thanh toán</Label>
            <Input
              id="pub-payment"
              placeholder="VD: Chuyển khoản, PayPal..."
              value={form.payment_method}
              onChange={(e) =>
                setForm((p) => ({ ...p, payment_method: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          {/* Bank Info */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-bank">Thông tin ngân hàng</Label>
            <Textarea
              id="pub-bank"
              placeholder="Số tài khoản, tên ngân hàng, tên chủ tài khoản..."
              rows={3}
              value={form.bank_info}
              onChange={(e) =>
                setForm((p) => ({ ...p, bank_info: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-notes">Ghi chú</Label>
            <Textarea
              id="pub-notes"
              placeholder="Ghi chú nội bộ về publisher..."
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          {/* Active status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() =>
                !isSubmitting &&
                setForm((p) => ({ ...p, is_active: !p.is_active }))
              }
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                form.is_active ? "bg-blue-600" : "bg-gray-200",
                isSubmitting && "pointer-events-none opacity-50"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                  form.is_active ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <Label className="cursor-pointer select-none">
              {form.is_active ? "Đang hoạt động" : "Không hoạt động"}
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Lưu thay đổi" : "Thêm Publisher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
