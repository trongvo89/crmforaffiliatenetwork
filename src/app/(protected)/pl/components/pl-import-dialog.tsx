"use client";

import React, { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  period_month: string;
  revenue: number;
  publisher_cost: number;
  salary_cost: number;
  bonus_cost: number;
  other_cost: number;
}

interface ParsedResult {
  row: number;
  data: ParsedRow | null;
  error: string | null;
}

interface PlImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  onImported: () => void;
}

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE = `period_month,revenue,publisher_cost,salary_cost,bonus_cost,other_cost
2025-01,100000000,60000000,20000000,5000000,2000000
2025-02,120000000,72000000,20000000,6000000,2500000
`;

// ─── CSV Parser (inline, no external library) ─────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  if (isNaN(n)) return null;
  return n;
}

function parseCSV(csvText: string): ParsedResult[] {
  const lines = csvText.split(/\r?\n/);
  const results: ParsedResult[] = [];

  // Find header row (skip if it's the header)
  let dataLines = lines;
  if (
    lines.length > 0 &&
    lines[0].toLowerCase().includes("period_month")
  ) {
    dataLines = lines.slice(1);
  }

  dataLines.forEach((line, index) => {
    const rawLine = line.trim();
    if (!rawLine) return; // skip empty lines

    const rowNum = index + 2; // +2 because row 1 is header
    const fields = parseCSVLine(rawLine);

    const [
      period_month_raw = "",
      revenue_raw = "",
      publisher_cost_raw = "",
      salary_cost_raw = "",
      bonus_cost_raw = "",
      other_cost_raw = "",
    ] = fields;

    const period_month = period_month_raw.trim();
    const revenue_str = revenue_raw.trim();
    const publisher_cost_str = publisher_cost_raw.trim();

    // Validate period_month
    if (!period_month || !/^\d{4}-\d{2}$/.test(period_month)) {
      results.push({
        row: rowNum,
        data: null,
        error: "Định dạng tháng không hợp lệ (cần YYYY-MM)",
      });
      return;
    }

    // Validate revenue
    if (!revenue_str) {
      results.push({
        row: rowNum,
        data: null,
        error: "Doanh thu/Chi phí phải là số",
      });
      return;
    }
    const revenue = parseNumber(revenue_str);
    if (revenue === null) {
      results.push({
        row: rowNum,
        data: null,
        error: "Doanh thu/Chi phí phải là số",
      });
      return;
    }

    // Validate publisher_cost
    if (!publisher_cost_str) {
      results.push({
        row: rowNum,
        data: null,
        error: "Doanh thu/Chi phí phải là số",
      });
      return;
    }
    const publisher_cost = parseNumber(publisher_cost_str);
    if (publisher_cost === null) {
      results.push({
        row: rowNum,
        data: null,
        error: "Doanh thu/Chi phí phải là số",
      });
      return;
    }

    // Optional fields — default to 0
    const salary_cost = parseNumber(salary_cost_raw.trim()) ?? 0;
    const bonus_cost = parseNumber(bonus_cost_raw.trim()) ?? 0;
    const other_cost = parseNumber(other_cost_raw.trim()) ?? 0;

    results.push({
      row: rowNum,
      data: {
        period_month,
        revenue,
        publisher_cost,
        salary_cost,
        bonus_cost,
        other_cost,
      },
      error: null,
    });
  });

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlImportDialog({
  open,
  onOpenChange,
  companyId,
  onImported,
}: PlImportDialogProps) {
  const [parsedResults, setParsedResults] = useState<ParsedResult[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = parsedResults
    .filter((r) => r.data !== null)
    .map((r) => r.data as ParsedRow);
  const errorRows = parsedResults.filter((r) => r.error !== null);

  // Reset all state when dialog closes
  function handleOpenChange(v: boolean) {
    if (!v) {
      setParsedResults([]);
      setFileName(null);
      setImporting(false);
      setImportError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(v);
  }

  function handleDownloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pl_monthly_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") return;
      const results = parseCSV(text);
      setParsedResults(results);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (validRows.length === 0 || importing) return;
    setImporting(true);
    setImportError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pl_monthly")
        .upsert(
          validRows.map((r) => ({ ...r, company_id: companyId })),
          { onConflict: "company_id,period_month" }
        );

      if (error) throw error;

      onImported();
      handleOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Có lỗi xảy ra khi import";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  }

  const hasFile = fileName !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV — Dữ liệu P&amp;L hàng tháng
          </DialogTitle>
          <DialogDescription>
            Tải lên file CSV để nhập hàng loạt dữ liệu P&amp;L. Dữ liệu trùng tháng sẽ được cập nhật (upsert).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Instructions */}
          {!hasFile && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 space-y-3">
              <p className="text-sm font-medium text-gray-700">Định dạng file CSV yêu cầu:</p>
              <pre className="text-xs bg-white border rounded p-3 overflow-x-auto text-gray-700 leading-relaxed">
                {`period_month,revenue,publisher_cost,salary_cost,bonus_cost,other_cost\n2025-01,100000000,60000000,20000000,5000000,2000000\n2025-02,120000000,72000000,20000000,6000000,2500000`}
              </pre>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-gray-600">Lưu ý:</span>{" "}
                <code className="bg-gray-100 px-1 rounded">period_month</code> phải có định dạng{" "}
                <code className="bg-gray-100 px-1 rounded">YYYY-MM</code>. Dữ liệu trùng tháng sẽ được cập nhật (upsert).
                Các cột <code className="bg-gray-100 px-1 rounded">salary_cost</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">bonus_cost</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">other_cost</code> là tuỳ chọn (mặc định 0).
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-1.5" />
                Tải template CSV
              </Button>
            </div>
          )}

          {/* File input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Chọn file CSV
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                File đã chọn: <span className="font-medium text-gray-700">{fileName}</span>
              </p>
            )}
          </div>

          {/* Step 2: Preview */}
          {hasFile && parsedResults.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {validRows.length} dòng hợp lệ
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    {errorRows.length} dòng lỗi
                  </span>
                )}
              </div>

              {/* Error list */}
              {errorRows.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700 mb-2">Các dòng bị lỗi:</p>
                  {errorRows.map((r) => (
                    <p key={r.row} className="text-xs text-red-600">
                      Dòng {r.row}: {r.error}
                    </p>
                  ))}
                </div>
              )}

              {/* Preview table */}
              {validRows.length > 0 && (
                <div className="rounded-lg border overflow-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Tháng</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Doanh thu</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Chi phí PUB</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Lương</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Bonus</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Khác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {validRows.map((row) => (
                        <tr key={row.period_month} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{row.period_month}</td>
                          <td className="px-3 py-2 text-right text-blue-700">
                            {row.revenue.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3 py-2 text-right text-orange-600">
                            {row.publisher_cost.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {row.salary_cost.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {row.bonus_cost.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {row.other_cost.toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{importError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={importing}>
            Hủy
          </Button>
          {!hasFile && (
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1.5" />
              Tải template CSV
            </Button>
          )}
          {hasFile && (
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Đang import...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import {validRows.length} tháng
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
