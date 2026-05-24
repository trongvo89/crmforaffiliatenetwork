"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { Publisher } from "./publisher-form";

// ─── Local insert type (no DB-generated fields) ───────────────────────────────

type PublisherInsert = {
  name: string;
  email: string | null;
  tier: "Platinum" | "Gold" | "Silver" | "Bronze";
  traffic_sources: string[];
  payment_method: string | null;
  bank_info: string | null;
  notes: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TIERS = ["Platinum", "Gold", "Silver", "Bronze"] as const;
type Tier = (typeof VALID_TIERS)[number];

const VALID_TRAFFIC_SOURCES = [
  "facebook",
  "native",
  "email",
  "push",
  "seo",
  "other",
] as const;

const CSV_TEMPLATE =
  "name,email,tier,traffic_sources,payment_method,bank_info,notes\n" +
  'Publisher A,pub@example.com,Gold,"facebook,native",Chuyển khoản,ACB 123456,Đối tác tốt\n' +
  "Publisher B,pub2@example.com,Bronze,seo,,,\n";

// ─── CSV parsing helpers ──────────────────────────────────────────────────────

/** Parse a single CSV line respecting double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // trailing empty field after last comma — handled below via push
      break;
    }
    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let value = "";
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            // escaped quote
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // skip comma
      if (line[i] === ",") i++;
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      } else {
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
  }
  return fields;
}

interface ParsedRow {
  rowIndex: number; // 1-based (excluding header)
  data: PublisherInsert;
}

interface ParseError {
  rowIndex: number;
  reasons: string[];
}

interface ParseResult {
  valid: ParsedRow[];
  errors: ParseError[];
}

function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const valid: ParsedRow[] = [];
  const errors: ParseError[] = [];

  // Skip header (first non-empty line)
  let headerSkipped = false;
  let rowIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;
    // Skip lines that are all commas
    if (/^,*$/.test(trimmed)) continue;

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    rowIndex++;
    const fields = parseCsvLine(line);

    const [
      rawName = "",
      rawEmail = "",
      rawTier = "",
      rawTrafficSources = "",
      rawPaymentMethod = "",
      rawBankInfo = "",
      rawNotes = "",
    ] = fields;

    const reasons: string[] = [];

    // Validate name
    const name = rawName.trim();
    if (!name) {
      reasons.push("Thiếu tên");
    }

    // Tier
    const tierRaw = rawTier.trim();
    let tier: Tier = "Bronze";
    if (!tierRaw) {
      tier = "Bronze";
    } else if (VALID_TIERS.includes(tierRaw as Tier)) {
      tier = tierRaw as Tier;
    } else {
      reasons.push("Tier không hợp lệ (Platinum/Gold/Silver/Bronze)");
    }

    // Traffic sources
    const trafficSourcesRaw = rawTrafficSources.trim();
    const trafficSources: string[] = [];
    if (trafficSourcesRaw) {
      const parts = trafficSourcesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const invalidSources: string[] = [];
      for (const part of parts) {
        if (VALID_TRAFFIC_SOURCES.includes(part as (typeof VALID_TRAFFIC_SOURCES)[number])) {
          trafficSources.push(part);
        } else {
          invalidSources.push(part);
        }
      }
      if (invalidSources.length > 0) {
        reasons.push("traffic_source không hợp lệ");
      }
    }

    if (reasons.length > 0) {
      errors.push({ rowIndex, reasons });
    } else {
      valid.push({
        rowIndex,
        data: {
          name,
          email: rawEmail.trim() || null,
          tier,
          traffic_sources: trafficSources,
          payment_method: rawPaymentMethod.trim() || null,
          bank_info: rawBankInfo.trim() || null,
          notes: rawNotes.trim() || null,
        },
      });
    }
  }

  return { valid, errors };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublisherImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  onImported: (publishers: Publisher[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublisherImportDialog({
  open,
  onOpenChange,
  companyId,
  onImported,
}: PublisherImportDialogProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [importing, setImporting] = React.useState(false);
  const [successCount, setSuccessCount] = React.useState<number | null>(null);

  // Preview rows (all parsed rows for display, capped at 10)
  const previewRows = React.useMemo(() => {
    if (!parseResult) return [];
    // Combine valid + error rows sorted by rowIndex for display
    const allRows: { rowIndex: number; data?: PublisherInsert; reasons?: string[] }[] = [
      ...parseResult.valid.map((r) => ({ rowIndex: r.rowIndex, data: r.data })),
      ...parseResult.errors.map((r) => ({ rowIndex: r.rowIndex, reasons: r.reasons })),
    ];
    allRows.sort((a, b) => a.rowIndex - b.rowIndex);
    return allRows.slice(0, 10);
  }, [parseResult]);

  // ── Reset when dialog closes ────────────────────────────────────────────────

  React.useEffect(() => {
    if (!open) {
      setParseResult(null);
      setFileName("");
      setImporting(false);
      setSuccessCount(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  // ── Template download ───────────────────────────────────────────────────────

  function handleDownloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "publisher_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── File selection ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        const result = parseCsv(text);
        setParseResult(result);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!parseResult || parseResult.valid.length === 0) return;
    setImporting(true);

    const supabase = createClient();
    const rows = parseResult.valid.map((r) => ({
      ...r.data,
      company_id: companyId,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from("publishers")
      .insert(rows)
      .select();

    setImporting(false);

    if (error) {
      // Show a basic error — could be enhanced with toast
      alert(`Lỗi khi import: ${error.message}`);
      return;
    }

    const inserted = (data ?? []) as Publisher[];
    setSuccessCount(inserted.length);
    onImported(inserted);

    // Close after a short delay so user sees the success message
    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasFile = parseResult !== null;
  const validCount = parseResult?.valid.length ?? 0;
  const errorCount = parseResult?.errors.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Publisher từ CSV</DialogTitle>
          <DialogDescription>
            Tải lên file CSV để thêm nhiều publisher cùng lúc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Instructions + template download */}
          {!hasFile && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center space-y-3">
              <Upload className="mx-auto h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Chọn file CSV để bắt đầu import
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  File phải có các cột: name, email, tier, traffic_sources,
                  payment_method, bank_info, notes
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Tải template CSV
              </Button>
            </div>
          )}

          {/* File input */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {hasFile ? "Chọn file khác" : "Chọn file CSV"}
            </Button>
            {fileName && (
              <span className="text-sm text-gray-600 truncate max-w-xs">
                {fileName}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Step 2: Preview + summary */}
          {hasFile && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {validCount} hàng hợp lệ
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    {errorCount} hàng lỗi
                  </span>
                )}
              </div>

              {/* Preview table */}
              {previewRows.length > 0 && (
                <div className="overflow-auto max-h-52 rounded-lg border text-xs">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">
                          Tên
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">
                          Email
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">
                          Tier
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">
                          Traffic
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {previewRows.map((row) => {
                        const isError = !!row.reasons;
                        return (
                          <tr
                            key={row.rowIndex}
                            className={isError ? "bg-red-50" : undefined}
                          >
                            <td className="px-3 py-1.5 text-gray-500">
                              {row.rowIndex}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-gray-900">
                              {row.data?.name ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-gray-600">
                              {row.data?.email ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-gray-600">
                              {row.data?.tier ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-gray-600">
                              {row.data?.traffic_sources?.join(", ") || "—"}
                            </td>
                            <td className="px-3 py-1.5">
                              {isError ? (
                                <span className="text-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  Lỗi
                                </span>
                              ) : (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(parseResult?.valid.length ?? 0) +
                    (parseResult?.errors.length ?? 0) >
                    10 && (
                    <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                      Chỉ hiển thị 10 hàng đầu tiên
                    </p>
                  )}
                </div>
              )}

              {/* Error details */}
              {parseResult && parseResult.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700 mb-1">
                    Chi tiết lỗi:
                  </p>
                  {parseResult.errors.map((err) => (
                    <p key={err.rowIndex} className="text-xs text-red-600">
                      Hàng {err.rowIndex}: {err.reasons.join(", ")}
                    </p>
                  ))}
                </div>
              )}

              {/* Success message */}
              {successCount !== null && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã import {successCount} publisher thành công
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Đóng
          </Button>
          {hasFile && successCount === null && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={validCount === 0 || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang import...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {validCount} hàng hợp lệ
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
