// Pure matching logic — no React/browser deps

export type MatchStatus = "matched" | "our_only" | "adv_only" | "amount_mismatch";

export type ParsedRow = Record<string, string>;

export interface ColumnMapping {
  click_id?: string;
  conversion_id?: string;
  amount?: string;
  date?: string;
  publisher_id?: string; // our file only
}

export interface MatchResult {
  match_status: MatchStatus;
  click_id: string | null;
  conversion_id: string | null;
  our_amount: number | null;
  adv_amount: number | null;
  transaction_date: string | null; // ISO date string YYYY-MM-DD
  publisher_id: string | null;
  raw_data: {
    our?: ParsedRow;
    adv?: ParsedRow;
  };
}

function getField(row: ParsedRow, colName: string | undefined): string {
  if (!colName) return "";
  return (row[colName] ?? "").toString().trim();
}

function parseAmount(val: string): number {
  // Remove currency symbols, spaces, commas
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

function parseISODate(val: string): Date | null {
  if (!val) return null;
  // Try common formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
  const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(val.substring(0, 10));
  const dmy = val.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
  const mdy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return new Date(`${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toISODateString(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

const AMOUNT_TOLERANCE = 0.01; // 1%
const DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000; // 1 day

function amountsClose(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / denom <= AMOUNT_TOLERANCE;
}

function datesClose(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.getTime() - b.getTime()) <= DATE_TOLERANCE_MS;
}

export function autoMatch(
  ourRows: ParsedRow[],
  advRows: ParsedRow[],
  ourMapping: ColumnMapping,
  advMapping: ColumnMapping
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedAdvIdx = new Set<number>();

  for (const ourRow of ourRows) {
    const ourClickId = getField(ourRow, ourMapping.click_id);
    const ourConvId = getField(ourRow, ourMapping.conversion_id);
    const ourAmount = parseAmount(getField(ourRow, ourMapping.amount));
    const ourDate = parseISODate(getField(ourRow, ourMapping.date));
    const ourPubId = getField(ourRow, ourMapping.publisher_id) || null;

    let matched = false;

    // ── Primary match: exact ID ──────────────────────────────────────────
    if (ourClickId || ourConvId) {
      for (let i = 0; i < advRows.length; i++) {
        if (usedAdvIdx.has(i)) continue;
        const advRow = advRows[i];
        const advClickId = getField(advRow, advMapping.click_id);
        const advConvId = getField(advRow, advMapping.conversion_id);

        const idMatch =
          (ourClickId && advClickId && ourClickId === advClickId) ||
          (ourConvId && advConvId && ourConvId === advConvId);

        if (idMatch) {
          const advAmount = parseAmount(getField(advRow, advMapping.amount));
          const advDate = parseISODate(getField(advRow, advMapping.date));
          const exactAmount = amountsClose(ourAmount, advAmount);

          results.push({
            match_status: exactAmount ? "matched" : "amount_mismatch",
            click_id: ourClickId || advClickId || null,
            conversion_id: ourConvId || advConvId || null,
            our_amount: ourAmount,
            adv_amount: advAmount,
            transaction_date: toISODateString(ourDate) ?? toISODateString(advDate),
            publisher_id: ourPubId,
            raw_data: { our: ourRow, adv: advRow },
          });
          usedAdvIdx.add(i);
          matched = true;
          break;
        }
      }
    }

    // ── Fallback match: amount ±1% + date ±1 day ────────────────────────
    if (!matched) {
      for (let i = 0; i < advRows.length; i++) {
        if (usedAdvIdx.has(i)) continue;
        const advRow = advRows[i];
        const advAmount = parseAmount(getField(advRow, advMapping.amount));
        const advDate = parseISODate(getField(advRow, advMapping.date));

        if (amountsClose(ourAmount, advAmount) && datesClose(ourDate, advDate)) {
          const exactAmount = Math.abs(ourAmount - advAmount) < 0.001;
          results.push({
            match_status: exactAmount ? "matched" : "amount_mismatch",
            click_id: null,
            conversion_id: null,
            our_amount: ourAmount,
            adv_amount: advAmount,
            transaction_date: toISODateString(ourDate),
            publisher_id: ourPubId,
            raw_data: { our: ourRow, adv: advRow },
          });
          usedAdvIdx.add(i);
          matched = true;
          break;
        }
      }
    }

    // ── Our only ─────────────────────────────────────────────────────────
    if (!matched) {
      results.push({
        match_status: "our_only",
        click_id: ourClickId || null,
        conversion_id: ourConvId || null,
        our_amount: ourAmount,
        adv_amount: null,
        transaction_date: toISODateString(ourDate),
        publisher_id: ourPubId,
        raw_data: { our: ourRow },
      });
    }
  }

  // ── ADV only ─────────────────────────────────────────────────────────────
  for (let i = 0; i < advRows.length; i++) {
    if (usedAdvIdx.has(i)) continue;
    const advRow = advRows[i];
    const advAmount = parseAmount(getField(advRow, advMapping.amount));
    const advDate = parseISODate(getField(advRow, advMapping.date));
    const advClickId = getField(advRow, advMapping.click_id);
    const advConvId = getField(advRow, advMapping.conversion_id);

    results.push({
      match_status: "adv_only",
      click_id: advClickId || null,
      conversion_id: advConvId || null,
      our_amount: null,
      adv_amount: advAmount,
      transaction_date: toISODateString(advDate),
      publisher_id: null,
      raw_data: { adv: advRow },
    });
  }

  return results;
}

export function calcMatchRate(results: MatchResult[]): number {
  if (results.length === 0) return 0;
  const matched = results.filter((r) => r.match_status === "matched").length;
  return (matched / results.length) * 100;
}
