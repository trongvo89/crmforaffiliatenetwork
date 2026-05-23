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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export interface Advertiser {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  payment_terms: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AdvertiserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advertiser?: Advertiser | null;
  companyId: string;
  onSaved: (advertiser: Advertiser) => void;
}

interface FormState {
  name: string;
  contact_name: string;
  contact_email: string;
  payment_terms: string;
  notes: string;
  is_active: boolean;
}

const defaultForm: FormState = {
  name: "",
  contact_name: "",
  contact_email: "",
  payment_terms: "30",
  notes: "",
  is_active: true,
};

export function AdvertiserForm({
  open,
  onOpenChange,
  advertiser,
  companyId,
  onSaved,
}: AdvertiserFormProps) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState>(defaultForm);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});

  const isEditing = !!advertiser;

  React.useEffect(() => {
    if (open) {
      if (advertiser) {
        setForm({
          name: advertiser.name,
          contact_name: advertiser.contact_name ?? "",
          contact_email: advertiser.contact_email ?? "",
          payment_terms: String(advertiser.payment_terms),
          notes: advertiser.notes ?? "",
          is_active: advertiser.is_active,
        });
      } else {
        setForm(defaultForm);
      }
      setErrors({});
    }
  }, [open, advertiser]);

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = "Tên advertiser là bắt buộc";
    }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      newErrors.contact_email = "Email không hợp lệ";
    }
    const pt = Number(form.payment_terms);
    if (isNaN(pt) || pt < 0) {
      newErrors.payment_terms = "Điều khoản thanh toán phải là số không âm";
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
      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        payment_terms: Number(form.payment_terms) || 30,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      let result: Advertiser;

      if (isEditing && advertiser) {
        const { data, error } = await supabase
          .from("advertisers")
          .update(payload)
          .eq("id", advertiser.id)
          .eq("company_id", advertiser.company_id)
          .select()
          .single();

        if (error) throw error;
        result = data as Advertiser;
      } else {
        const { data, error } = await supabase
          .from("advertisers")
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select()
          .single();

        if (error) throw error;
        result = data as Advertiser;
      }

      toast({
        title: isEditing ? "Đã cập nhật advertiser" : "Đã thêm advertiser",
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

  function handleChange(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Chỉnh sửa Advertiser" : "Thêm Advertiser mới"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cập nhật thông tin advertiser bên dưới."
              : "Điền thông tin để tạo advertiser mới."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tên advertiser */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-name">
              Tên advertiser <span className="text-red-500">*</span>
            </Label>
            <Input
              id="adv-name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="VD: Shopee Vietnam"
              disabled={loading}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Contact name */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-contact-name">Tên liên hệ</Label>
            <Input
              id="adv-contact-name"
              value={form.contact_name}
              onChange={(e) => handleChange("contact_name", e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              disabled={loading}
            />
          </div>

          {/* Contact email */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-contact-email">Email liên hệ</Label>
            <Input
              id="adv-contact-email"
              type="email"
              value={form.contact_email}
              onChange={(e) => handleChange("contact_email", e.target.value)}
              placeholder="contact@advertiser.com"
              disabled={loading}
            />
            {errors.contact_email && (
              <p className="text-xs text-red-500">{errors.contact_email}</p>
            )}
          </div>

          {/* Payment terms */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-payment-terms">
              Điều khoản thanh toán{" "}
              <span className="text-muted-foreground font-normal">(Số ngày NET)</span>
            </Label>
            <Input
              id="adv-payment-terms"
              type="number"
              min="0"
              value={form.payment_terms}
              onChange={(e) => handleChange("payment_terms", e.target.value)}
              placeholder="30"
              disabled={loading}
            />
            {errors.payment_terms && (
              <p className="text-xs text-red-500">{errors.payment_terms}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-notes">Ghi chú</Label>
            <Textarea
              id="adv-notes"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Ghi chú thêm về advertiser..."
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Is active */}
          <div className="flex items-center gap-2">
            <input
              id="adv-is-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="adv-is-active" className="cursor-pointer">
              Đang hoạt động
            </Label>
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
              {isEditing ? "Lưu thay đổi" : "Thêm Advertiser"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
