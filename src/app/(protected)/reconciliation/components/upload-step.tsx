"use client";

import * as React from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Upload, FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import {
  autoMatch,
  calcMatchRate,
  type ParsedRow,
  type ColumnMapping,
  type MatchResult,
} from "./match-utils";
import type { ReconSession } from "./session-form";

interface UploadStepProps {
  session: ReconSession;
  onMatchComplete: (updatedSession: ReconSession) => void;
}

interface ParsedFile {
  fileName: string;
  rows: ParsedRow[];
  columns: string[];
}

const REQUIRED_OUR_FIELDS: Array<{ key: keyof ColumnMapping; label: string; required: boolean }> = [
  { key: "click_id", label: "Click ID", required: false },
  { key: "conversion_id", label: "Conversion ID", required: false },
  { key: "amount", label: "Số tiền *", required: true },
  { key: "date", label: "Ngày *", required: true },
  { key: "publisher_id", label: "Publisher ID", required: false },
];

const REQUIRED_ADV_FIELDS: Array<{ key: keyof ColumnMapping; label: string; required: boolean }> = [
  { key: "click_id", label: "Click ID", required: false },
  { key: "conversion_id", label: "Conversion ID", required: false },
  { key: "amount", label: "Số tiền *", required: true },
  { key: "date", label: "Ngày *", required: true },
];

function localStorageKey(advertiserId: string, side: "our" | "adv") {
  return `recon_col_map_${advertiserId}_${side}`;
}

function loadSavedMapping(advertiserId: string, side: "our" | "adv"): ColumnMapping {
  try {
    const raw = localStorage.getItem(localStorageKey(advertiserId, side));
    return raw ? (JSON.parse(raw) as ColumnMapping) : {};
  } catch {
    return {};
  }
}

function saveMapping(advertiserId: string, side: "our" | "adv", mapping: ColumnMapping) {
  try {
    localStorage.setItem(localStorageKey(advertiserId, side), JSON.stringify(mapping));
  } catch {}
}

async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data as ParsedRow[];
          const columns = result.meta.fields ?? [];
          resolve({ fileName: file.name, rows, columns });
        },
        error: reject,
      });
    });
  } else if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { raw: false });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { fileName: file.name, rows, columns };
  } else {
    throw new Error("Chỉ hỗ trợ CSV, XLSX, XLS");
  }
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────

interface DropZoneProps {
  label: string;
  parsed: ParsedFile | null;
  onFile: (file: File) => void;
  onClear: () => void;
  loading: boolean;
}

function DropZone({ label, parsed, onFile, onClear, loading }: DropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {parsed ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="font-medium text-green-800 truncate">{parsed.fileName}</span>
          <span className="text-green-600">({parsed.rows.length} dòng)</span>
          {!loading && (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto text-gray-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-muted-foreground">
            Kéo thả file hoặc <span className="text-blue-600 font-medium">click để chọn</span>
          </p>
          <p className="text-xs text-gray-400">Hỗ trợ CSV, XLSX, XLS</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Preview Table ────────────────────────────────────────────────────────────

function PreviewTable({ parsed }: { parsed: ParsedFile }) {
  const preview = parsed.rows.slice(0, 5);
  return (
    <div className="overflow-x-auto rounded-md border text-xs">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            {parsed.columns.map((col) => (
              <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              {parsed.columns.map((col) => (
                <td key={col} className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">
                  {row[col] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {parsed.rows.length > 5 && (
        <p className="px-3 py-1.5 text-xs text-muted-foreground bg-gray-50">
          ... và {parsed.rows.length - 5} dòng nữa
        </p>
      )}
    </div>
  );
}

// ─── Column Mapper ────────────────────────────────────────────────────────────

interface ColumnMapperProps {
  label: string;
  columns: string[];
  mapping: ColumnMapping;
  fields: typeof REQUIRED_OUR_FIELDS;
  onChange: (mapping: ColumnMapping) => void;
}

function ColumnMapper({ label, columns, mapping, fields, onChange }: ColumnMapperProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, label: fieldLabel }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel}</Label>
            <Select
              value={mapping[key] ?? ""}
              onValueChange={(val) => onChange({ ...mapping, [key]: val || undefined })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="-- Không ánh xạ --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Không ánh xạ --</SelectItem>
                {columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Upload Step ─────────────────────────────────────────────────────────

export function UploadStep({ session, onMatchComplete }: UploadStepProps) {
  const { toast } = useToast();

  const [ourFile, setOurFile] = React.useState<ParsedFile | null>(null);
  const [advFile, setAdvFile] = React.useState<ParsedFile | null>(null);
  const [ourMapping, setOurMapping] = React.useState<ColumnMapping>({});
  const [advMapping, setAdvMapping] = React.useState<ColumnMapping>({});
  const [loading, setLoading] = React.useState(false);

  // Load saved mappings for this advertiser
  React.useEffect(() => {
    if (session.advertiser_id) {
      setOurMapping(loadSavedMapping(session.advertiser_id, "our"));
      setAdvMapping(loadSavedMapping(session.advertiser_id, "adv"));
    }
  }, [session.advertiser_id]);

  async function handleFile(side: "our" | "adv", file: File) {
    try {
      const parsed = await parseFile(file);
      if (side === "our") setOurFile(parsed);
      else setAdvFile(parsed);
    } catch (err: unknown) {
      toast({
        title: "Lỗi đọc file",
        description: err instanceof Error ? err.message : "Không thể đọc file",
        variant: "destructive",
      });
    }
  }

  function canRun(): boolean {
    return (
      !!ourFile &&
      !!advFile &&
      !!ourMapping.amount &&
      !!ourMapping.date &&
      !!advMapping.amount &&
      !!advMapping.date
    );
  }

  async function handleRunMatch() {
    if (!ourFile || !advFile) return;
    setLoading(true);

    try {
      // Save column mappings for this advertiser
      if (session.advertiser_id) {
        saveMapping(session.advertiser_id, "our", ourMapping);
        saveMapping(session.advertiser_id, "adv", advMapping);
      }

      // Run matching algorithm
      const results: MatchResult[] = autoMatch(
        ourFile.rows,
        advFile.rows,
        ourMapping,
        advMapping
      );
      const matchRate = calcMatchRate(results);

      const supabase = createClient();

      // Upload raw files to storage
      const ts = Date.now();
      const ourPath = `${session.company_id}/${session.id}/our_${ts}_${ourFile.fileName}`;
      const advPath = `${session.company_id}/${session.id}/adv_${ts}_${advFile.fileName}`;

      // We upload as JSON blobs (raw parsed data) to avoid binary file handling complexity
      const ourBlob = new Blob([JSON.stringify(ourFile.rows)], { type: "application/json" });
      const advBlob = new Blob([JSON.stringify(advFile.rows)], { type: "application/json" });

      const [ourUpload, advUpload] = await Promise.all([
        supabase.storage.from("reconciliation-files").upload(ourPath, ourBlob, { upsert: true }),
        supabase.storage.from("reconciliation-files").upload(advPath, advBlob, { upsert: true }),
      ]);

      if (ourUpload.error) console.warn("Our file upload failed:", ourUpload.error.message);
      if (advUpload.error) console.warn("Adv file upload failed:", advUpload.error.message);

      // Save recon records in batches
      const records = results.map((r) => ({
        session_id: session.id,
        match_status: r.match_status,
        click_id: r.click_id,
        conversion_id: r.conversion_id,
        our_amount: r.our_amount,
        adv_amount: r.adv_amount,
        transaction_date: r.transaction_date,
        publisher_id: r.publisher_id || null,
        raw_data: r.raw_data,
      }));

      // Insert in chunks of 500
      for (let i = 0; i < records.length; i += 500) {
        const { error } = await supabase
          .from("recon_records")
          .insert(records.slice(i, i + 500));
        if (error) throw error;
      }

      // Update session status to review
      const { data: updatedSession, error: sessionError } = await supabase
        .from("recon_sessions")
        .update({
          status: "review",
          match_rate: Math.round(matchRate * 100) / 100,
          our_file_url: ourUpload.data?.path ?? null,
          adv_file_url: advUpload.data?.path ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq("company_id", session.company_id)
        .select(`*, advertisers(id, name)`)
        .single();

      if (sessionError) throw sessionError;

      toast({
        title: "Đối soát hoàn tất",
        description: `Tỷ lệ khớp: ${matchRate.toFixed(1)}% — ${results.length} bản ghi`,
      });
      onMatchComplete(updatedSession as ReconSession);
    } catch (err: unknown) {
      toast({
        title: "Lỗi chạy đối soát",
        description: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload file dữ liệu của bạn và file từ advertiser, sau đó ánh xạ các cột tương ứng để hệ thống tự động đối soát.
      </p>

      {/* File upload zones */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <DropZone
            label="File của chúng tôi"
            parsed={ourFile}
            onFile={(f) => handleFile("our", f)}
            onClear={() => setOurFile(null)}
            loading={loading}
          />
          {ourFile && <PreviewTable parsed={ourFile} />}
          {ourFile && (
            <ColumnMapper
              label="Ánh xạ cột — File của chúng tôi"
              columns={ourFile.columns}
              mapping={ourMapping}
              fields={REQUIRED_OUR_FIELDS}
              onChange={setOurMapping}
            />
          )}
        </div>

        <div className="space-y-4">
          <DropZone
            label="File của Advertiser"
            parsed={advFile}
            onFile={(f) => handleFile("adv", f)}
            onClear={() => setAdvFile(null)}
            loading={loading}
          />
          {advFile && <PreviewTable parsed={advFile} />}
          {advFile && (
            <ColumnMapper
              label="Ánh xạ cột — File ADV"
              columns={advFile.columns}
              mapping={advMapping}
              fields={REQUIRED_ADV_FIELDS}
              onChange={setAdvMapping}
            />
          )}
        </div>
      </div>

      {/* Validation hints */}
      {(ourFile || advFile) && !canRun() && (
        <p className="text-sm text-amber-600">
          Cần ánh xạ ít nhất cột <strong>Số tiền</strong> và <strong>Ngày</strong> cho cả hai file.
        </p>
      )}

      {/* Run button */}
      <div className="flex justify-end">
        <Button onClick={handleRunMatch} disabled={!canRun() || loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang đối soát...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Tiến hành đối soát
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
