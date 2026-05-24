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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { type Advertiser } from "./advertiser-form";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdvertiserImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  onImported: (advertisers: Advertiser[]) => void;
}

// ─── CSV row types ────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  payment_terms: number;
  notes: string | null;
}

interface ValidRow extends ParsedRow {
  _rowIndex: number;
}

interface ErrorRow {
  _rowIndex: number;
  rawName: string;
  error: string;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Parse a single CSV line, handling quoted fields that may contain commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped double-quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Parse CSV text into valid + error rows, skipping the header line. */
function parseCsv(text: string): { validRows: ValidRow[]; errorRows: ErrorRow[] } {
  const lines = text.split(/\r?\n/);
  const validRows: ValidRow[] = [];
  const errorRows: ErrorRow[] = [];

  // skip header (first non-blank line) and blank lines
  let headerSkipped = false;
  let rowIndex = 0;

  for (const line of lines) {
    if (line.trim() === "") continue;
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    rowIndex++;
    const fields = parseCsvLine(line);
    const [rawName = "", rawContactName = "", rawContactEmail = "", rawPaymentTerms = "", rawNotes = ""] = fields;

    const name = rawName.trim();
    if (!name) {
      errorRows.push({ _rowIndex: rowIndex, rawName: rawName, error: "Thiếu tên" });
      continue;
    }

    const ptNum = parseInt(rawPaymentTerms.trim(), 10);
    const payment_terms = isNaN(ptNum) || ptNum < 0 ? 30 : ptNum;

    validRows.push({
      _rowIndex: rowIndex,
      name,
      contact_name: rawContactName.trim() || null,
      contact_email: rawContactEmail.trim() || null,
      payment_terms,
      notes: rawNotes.trim() || null,
    });
  }

  return { validRows, errorRows };
}

// ─── Template CSV ─────────────────────────────────────────────────────────────

const TEMPLATE_CSV = `name,contact_name,contact_email,payment_terms,notes
Advertiser A,Nguyễn Văn A,contact@advertiser.com,30,Đối tác chiến lược
Advertiser B,Trần Thị B,b@advertiser.com,45,
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "advertiser_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdvertiserImportDialog({
  open,
  onOpenChange,
  companyId,
  onImported,
}: AdvertiserImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [validRows, setValidRows] = React.useState<ValidRow[]>([]);
  const [errorRows, setErrorRows] = React.useState<ErrorRow[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [imported, setImported] = React.useState(false);

  // ── Reset when dialog closes ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) {
      setValidRows([]);
      setErrorRows([]);
      setFileName(null);
      setImporting(false);
      setImported(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  // ── File selection ───────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const { validRows: vr, errorRows: er } = parseCsv(text);
      setValidRows(vr);
      setErrorRows(er);
    };
    reader.readAsText(file, "utf-8");
  }

  // ── Import ───────────────────────────────────────────────────────────────
  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("advertisers")
        .insert(
          validRows.map((r) => ({
            name: r.name,
            contact_name: r.contact_name,
            contact_email: r.contact_email,
            payment_terms: r.payment_terms,
            notes: r.notes,
            company_id: companyId,
            is_active: true,
          }))
        )
        .select();

      if (error) throw error;

      const inserted = (data ?? []) as Advertiser[];
      setImported(true);
      onImported(inserted);
      toast({
        title: "Import thành công",
        description: `Đã thêm ${inserted.length} advertiser.`,
      });
    } catch (err: unknown) {
      toast({
        title: "Lỗi import",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const hasParsed = fileName !== null;
  const previewRows = validRows.slice(0, 10);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Advertiser từ CSV
          </DialogTitle>
          <DialogDescription>
            Tải lên file CSV để thêm nhiều advertiser cùng lúc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Step 1: instructions + template ── */}
          {!hasParsed && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center space-y-3">
              <Upload className="mx-auto h-10 w-10 text-gray-300" />
              <div>
                <p className="font-medium text-gray-700">Chọn file CSV để upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  File phải có các cột: <span className="font-mono text-xs bg-white border rounded px-1">name, contact_name, contact_email, payment_terms, notes</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Tải template CSV
              </Button>
            </div>
          )}

          {/* ── File input ── */}
          <div className="space-y-2">
            <label
              htmlFor="csv-file-input"
              className="block text-sm font-medium text-gray-700"
            >
              {hasParsed ? "Thay đổi file" : "Chọn file CSV"}
            </label>
            <input
              id="csv-file-input"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importing}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
            />
          </div>

          {/* ── Step 2: summary + preview ── */}
          {hasParsed && (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700 border border-green-200">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-semibold">{validRows.length}</span> hàng hợp lệ
                </div>
                {errorRows.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm text-red-700 border border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-semibold">{errorRows.length}</span> hàng lỗi
                  </div>
                )}
              </div>

              {/* Preview table */}
              {validRows.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700">
                    Xem trước ({previewRows.length} / {validRows.length} hàng hợp lệ)
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Tên</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Liên hệ</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">NET (ngày)</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {previewRows.map((row) => (
                          <tr key={row._rowIndex} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-muted-foreground">{row._rowIndex}</td>
                            <td className="px-3 py-2 font-medium truncate max-w-[140px]">{row.name}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{row.contact_name ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]">{row.contact_email ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.payment_terms}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{row.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {validRows.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      ... và {validRows.length - 10} hàng nữa sẽ được import.
                    </p>
                  )}
                </div>
              )}

              {/* Error details */}
              {errorRows.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-red-700">Chi tiết lỗi</p>
                  <div className="rounded-lg border border-red-200 bg-red-50 divide-y divide-red-100 overflow-hidden">
                    {errorRows.map((er) => (
                      <div key={er._rowIndex} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="text-muted-foreground shrink-0">Hàng {er._rowIndex}:</span>
                        <span className="text-red-700 font-medium">{er.error}</span>
                        {er.rawName && (
                          <span className="text-muted-foreground truncate">({er.rawName})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success state */}
              {imported && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Import hoàn tất! {validRows.length} advertiser đã được thêm.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            {imported ? "Đóng" : "Hủy"}
          </Button>
          {hasParsed && !imported && (
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang import...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import {validRows.length} hàng hợp lệ
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
