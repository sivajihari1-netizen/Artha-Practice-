// Turns a column-mapped raw record into a normalized ExtractedRow: parses
// numbers/dates, resolves bank debit/credit columns into a single signed
// amount+direction, and computes the deterministic match key (spec section
// 2 — GSTIN+invoice for GST recon, date+amount+direction for bank recon).

import type { ColumnMap } from "./columnMapping";
import type { ExtractedRow, ExtractionMethod, LineItemSource, ReconciliationType } from "./types";

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const s = String(value).trim();
  // Common Indian export formats: DD-MM-YYYY, DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeGstin(gstin: unknown): string | null {
  if (gstin === null || gstin === undefined || gstin === "") return null;
  return String(gstin).trim().toUpperCase();
}

/** Strips leading zeros and whitespace, upper-cases — spec section 2A's normalization rule for invoice/reference numbers. */
export function normalizeReferenceNo(ref: unknown): string | null {
  if (ref === null || ref === undefined || ref === "") return null;
  const trimmed = String(ref).trim().toUpperCase();
  return trimmed.replace(/^0+(?=.)/, "") || null;
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value).trim();
}

/** Deterministic match key — GST rows key on GSTIN+invoice; bank rows key on date+amount+direction (spec section 2). */
export function computeNormalizedKey(row: {
  type: ReconciliationType;
  gstin: string | null;
  referenceNo: string | null;
  date: string | null;
  amount: number | null;
  direction: "debit" | "credit" | null;
}): string {
  if (row.type === "BANK_VS_BOOKS") {
    const day = row.date ? row.date.slice(0, 10) : "unknown-date";
    const amt = row.amount !== null ? row.amount.toFixed(2) : "unknown-amount";
    return `${day}::${amt}::${row.direction ?? "unknown"}`;
  }
  return `${row.gstin ?? ""}::${row.referenceNo ?? ""}`;
}

export function mapRawRecordToRow(params: {
  type: ReconciliationType;
  source: LineItemSource;
  record: Record<string, unknown>;
  mapping: ColumnMap;
  extractionMethod: ExtractionMethod;
  confidenceScore?: number;
}): ExtractedRow {
  const { type, source, record, mapping, extractionMethod } = params;
  const get = (field: keyof ColumnMap): unknown => (mapping[field] ? record[mapping[field] as string] : undefined);

  const gstin = normalizeGstin(get("gstin"));
  const referenceNo = normalizeReferenceNo(get("referenceNo"));
  const date = parseDateValue(get("date"));
  const counterparty = toStringOrNull(get("counterparty"));
  const taxAmount = parseNumber(get("taxAmount"));

  let amount: number | null;
  let direction: "debit" | "credit" | null = null;

  const debitAmount = parseNumber(get("debitAmount"));
  const creditAmount = parseNumber(get("creditAmount"));
  if (debitAmount !== null && debitAmount !== 0) {
    amount = debitAmount;
    direction = "debit";
  } else if (creditAmount !== null && creditAmount !== 0) {
    amount = creditAmount;
    direction = "credit";
  } else {
    amount = parseNumber(get("amount"));
    const directionRaw = toStringOrNull(get("direction"))?.toLowerCase();
    if (directionRaw) {
      direction = directionRaw.startsWith("d") ? "debit" : directionRaw.startsWith("c") ? "credit" : null;
    }
  }

  const normalizedKey = computeNormalizedKey({ type, gstin, referenceNo, date, amount, direction });

  return {
    source,
    rawRow: record,
    normalizedKey,
    date,
    amount,
    taxAmount,
    counterparty,
    referenceNo,
    gstin,
    direction,
    confidenceScore: params.confidenceScore ?? 90,
    extractionMethod,
  };
}
