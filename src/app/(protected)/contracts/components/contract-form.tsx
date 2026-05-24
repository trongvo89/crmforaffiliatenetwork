"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import type { Contract } from "../contracts-client";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContractFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  contract: Contract | null;
  onSaved: (c: Contract) => void;
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  party_name: string;
  party_type: Contract["party_type"];
  signed_date: string;
  expiry_date: string;
  notes: string;
};

const DEFAULT_FORM: FormState = {
  party_name: "",
  party_type: "publisher",
  signed_date: "",
  expiry_date: "",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractForm({
  open,
  onOpenChange,
  companyId,
  contract,
  onSaved,
}: ContractFormProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const isEditing = !!contract;

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);

  // ── File upload state ────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // ── Submission state ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = React.useState(false);

  // ── Sync form when contract prop changes ─────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      if (contract) {
        setForm({
          party_name: contract.party_name,
          party_type: contract.party_type,
          signed_date: contract.signed_date ?? "",
          expiry_date: contract.expiry_date ?? "",
          notes: contract.notes ?? "",
        });
        setUploadedFileUrl(contract.file_url ?? null);
      } else {
        setForm(DEFAULT_FORM);
        setUploadedFileUrl(null);
      }
      setSelectedFile(null);
      setUploading(false);
    }
  }, [open, contract]);

  // ── Field change ─────────────────────────────────────────────────────────────
  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── File selection & upload ──────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploading(true);

    try {
      const safeName = file.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      const path = `${companyId}/${Date.now()}_${safeName}`;
      const { data, error } = await supabase.storage
        .from("contracts")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      setUploadedFileUrl(data?.path ?? null);
      toast({ title: "Tải tệp thành công" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Tải tệp thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.party_name.trim()) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên đối tác.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        party_name: form.party_name.trim(),
        party_type: form.party_type,
        signed_date: form.signed_date || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes.trim() || null,
        company_id: companyId,
      };

      // Only update file_url if a new file was uploaded
      if (uploadedFileUrl !== (contract?.file_url ?? null)) {
        payload.file_url = uploadedFileUrl;
      }

      let data: Contract | null = null;

      if (isEditing && contract) {
        const { data: updated, error } = await supabase
          .from("contracts")
          .update(payload)
          .eq("id", contract.id)
          .eq("company_id", companyId)
          .select()
          .single();

        if (error) throw error;
        data = updated as Contract;
      } else {
        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({ ...payload, file_url: uploadedFileUrl })
          .select()
          .single();

        if (error) throw error;
        data = inserted as Contract;
      }

      if (!data) throw new Error("Không nhận được dữ liệu từ máy chủ.");

      onSaved(data);
      onOpenChange(false);
      toast({
        title: isEditing ? "Đã cập nhật hợp đồng" : "Đã thêm hợp đồng",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: isEditing ? "Cập nhật thất bại" : "Thêm thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Chỉnh sửa hợp đồng" : "Thêm hợp đồng mới"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cập nhật thông tin hợp đồng bên dưới."
              : "Nhập thông tin hợp đồng mới với đối tác."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* party_name */}
          <div className="space-y-1.5">
            <Label htmlFor="party_name">
              Tên đối tác <span className="text-red-500">*</span>
            </Label>
            <Input
              id="party_name"
              placeholder="Nhập tên công ty / cá nhân đối tác"
              value={form.party_name}
              onChange={(e) => handleField("party_name", e.target.value)}
              required
            />
          </div>

          {/* party_type */}
          <div className="space-y-1.5">
            <Label htmlFor="party_type">Loại đối tác</Label>
            <Select
              value={form.party_type}
              onValueChange={(v) =>
                handleField("party_type", v as Contract["party_type"])
              }
            >
              <SelectTrigger id="party_type">
                <SelectValue placeholder="Chọn loại đối tác" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="publisher">Publisher</SelectItem>
                <SelectItem value="advertiser">Advertiser</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* signed_date + expiry_date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="signed_date">Ngày ký</Label>
              <Input
                id="signed_date"
                type="date"
                value={form.signed_date}
                onChange={(e) => handleField("signed_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiry_date">Ngày hết hạn</Label>
              <Input
                id="expiry_date"
                type="date"
                value={form.expiry_date}
                onChange={(e) => handleField("expiry_date", e.target.value)}
              />
            </div>
          </div>

          {/* notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú thêm về hợp đồng (tuỳ chọn)"
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
              rows={3}
            />
          </div>

          {/* file upload */}
          <div className="space-y-1.5">
            <Label htmlFor="contract_file">
              Tệp hợp đồng{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (.pdf, .doc, .docx)
              </span>
            </Label>

            {/* Current / uploaded file indicator */}
            {(uploadedFileUrl || (isEditing && contract?.file_url && !selectedFile)) && !uploading && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <span className="truncate">
                  {selectedFile
                    ? selectedFile.name
                    : uploadedFileUrl ?? contract?.file_url ?? "Tệp đã tải lên"}
                </span>
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                <span>Đang tải lên…</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label
                htmlFor="contract_file"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
              >
                <FileText className="h-4 w-4" />
                {isEditing && contract?.file_url
                  ? "Thay thế tệp"
                  : "Chọn tệp"}
              </label>
              <Input
                id="contract_file"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading || submitting}
              />
              {selectedFile && !uploading && (
                <span className="truncate text-xs text-muted-foreground">
                  {selectedFile.name}
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || uploading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Lưu thay đổi" : "Thêm hợp đồng"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
