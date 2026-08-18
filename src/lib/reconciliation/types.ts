// Shared types for the Reconciliation Exception Engine pipeline
// (src/lib/reconciliation/*). See prisma/schema.prisma "Reconciliation
// Exception Engine" section for the persisted shape these mirror.

export type ReconciliationType = "GST_2B_VS_PURCHASE" | "GST_1_VS_SALES" | "BANK_VS_BOOKS";

export type LineItemSource = "A" | "B";

export type ExtractionMethod = "JSON_PARSE" | "CSV_PARSE" | "EXCEL_PARSE" | "PDF_OCR";

/** A normalized field, independent of the source spreadsheet's own column names — see columnMapping.ts. */
export type NormalizedField =
  | "gstin"
  | "referenceNo" // invoice number / cheque number / UTR
  | "date"
  | "amount" // taxable value (GST) or transaction amount (bank, single signed-amount column)
  | "taxAmount" // GST only
  | "counterparty" // supplier/buyer name (GST) or narration (bank)
  | "direction" // bank only, paired with `amount`: a column holding "debit"/"credit"/"dr"/"cr"
  | "debitAmount" // bank only: separate "Withdrawal Amt." column — common in Indian bank exports
  | "creditAmount"; // bank only: separate "Deposit Amt." column

/** One row extracted from a source file, before persistence. */
export type ExtractedRow = {
  source: LineItemSource;
  rawRow: Record<string, unknown>;
  normalizedKey: string;
  date: string | null; // ISO date
  amount: number | null;
  taxAmount: number | null;
  counterparty: string | null;
  referenceNo: string | null;
  gstin: string | null;
  direction: "debit" | "credit" | null; // bank recon only
  confidenceScore: number; // 0-100
  extractionMethod: ExtractionMethod;
};

export type MatchType = "EXACT" | "FUZZY" | "MANUAL";
export type MatchStatus = "MATCHED" | "EXCEPTION" | "RESOLVED" | "IGNORED";
export type ExceptionReason =
  | "MISSING_IN_BOOKS"
  | "MISSING_IN_SOURCE"
  | "AMOUNT_MISMATCH"
  | "DATE_MISMATCH"
  | "GSTIN_MISMATCH"
  | "DUPLICATE"
  | "RATE_MISMATCH";

/** One matching-engine result, before persistence — indices refer back into the extracted-row arrays passed to match(). */
export type MatchResult = {
  rowA: ExtractedRow | null;
  rowB: ExtractedRow | null;
  matchType: MatchType;
  matchConfidence: number;
  status: MatchStatus;
  exceptionReason: ExceptionReason | null;
};

/** Which side of a run is authoritative for "books" vs "source" language in explanations/reasons. */
export function booksSourceLabel(type: ReconciliationType): { sourceLabel: string; booksLabel: string } {
  switch (type) {
    case "GST_2B_VS_PURCHASE":
      return { sourceLabel: "GSTR-2B", booksLabel: "purchase register" };
    case "GST_1_VS_SALES":
      return { sourceLabel: "GSTR-1", booksLabel: "sales register" };
    case "BANK_VS_BOOKS":
      return { sourceLabel: "bank statement", booksLabel: "books" };
  }
}
