// EXTRACT step (spec section 4): turns an uploaded file into ExtractedRow[].
// CSV and Excel share a column-mapping path (section 4a); GSTR-2B JSON is
// parsed directly against the GST portal's known export shape at high
// confidence, with a flat-array fallback for GSP tools that pre-flatten it.

import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { ExtractedRow, LineItemSource, ReconciliationType } from "./types";
import { resolveColumnMapping, type ColumnMap, type ReconciliationSourceType } from "./columnMapping";
import { mapRawRecordToRow, normalizeGstin, normalizeReferenceNo, parseDateValue, parseNumber, computeNormalizedKey } from "./normalize";

export class ExtractionError extends Error {}

export type ExtractInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string | null;
};

export function detectFileKind(input: ExtractInput): "csv" | "excel" | "json" {
  const name = input.fileName.toLowerCase();
  if (input.mimeType === "application/json" || name.endsWith(".json")) return "json";
  if (
    input.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    input.mimeType === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return "excel";
  }
  return "csv";
}

function parseCsvRows(text: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.data.length === 0) throw new ExtractionError("File has no data rows.");
  return { headers: result.meta.fields ?? [], rows: result.data };
}

type ExcelCellValue = string | number | boolean | Date | null | { text?: string; result?: unknown };

async function parseExcelRows(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled @types/node version disagrees with this project's on the exact
  // Buffer shape (unrelated to the actual bytes) — a plain Buffer is what the API expects.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ExtractionError("Workbook has no sheets.");

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });
  if (headers.filter(Boolean).length === 0) {
    throw new ExtractionError("Couldn't find a header row — expected column headers in row 1.");
  }

  function resolveCellValue(value: ExcelCellValue): unknown {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("text" in value && value.text !== undefined) return value.text;
      if ("result" in value && value.result !== undefined) return value.result;
    }
    return value;
  }

  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const value = resolveCellValue(row.getCell(idx + 1).value as ExcelCellValue);
      record[header] = value ?? null;
      if (value !== null && value !== undefined && value !== "") hasValue = true;
    });
    if (hasValue) rows.push(record);
  }
  if (rows.length === 0) throw new ExtractionError("Excel file has no data rows.");
  return { headers: headers.filter(Boolean), rows };
}

/** Extract CSV or Excel rows into ExtractedRow[], using (and remembering) the client's column mapping. */
export async function extractTabular(params: {
  input: ExtractInput;
  source: LineItemSource;
  type: ReconciliationType;
  clientId: string;
  sourceType: ReconciliationSourceType;
}): Promise<{ items: ExtractedRow[]; mapping: ColumnMap; mappingWasStored: boolean; headers: string[] }> {
  const kind = detectFileKind(params.input);
  if (kind === "json") {
    throw new ExtractionError("Use the GSTR-2B/GSTR-1 JSON upload path for .json files, not the tabular one.");
  }

  const { headers, rows } =
    kind === "excel" ? await parseExcelRows(params.input.buffer) : parseCsvRows(params.input.buffer.toString("utf-8"));

  const { mapping, wasStored } = await resolveColumnMapping(params.clientId, params.sourceType, headers);

  const hasAnyUsefulMapping = mapping.referenceNo || mapping.amount || mapping.debitAmount || mapping.creditAmount;
  if (!hasAnyUsefulMapping) {
    throw new ExtractionError(
      "Couldn't map any recognizable columns (invoice/reference number, amount) — confirm the column mapping for this client via PATCH /reconciliation/clients/:id/column-mappings before uploading."
    );
  }

  const items = rows.map((record) =>
    mapRawRecordToRow({
      type: params.type,
      source: params.source,
      record,
      mapping,
      extractionMethod: kind === "excel" ? "EXCEL_PARSE" : "CSV_PARSE",
      // Lower confidence on a first-guess auto-detected mapping than on one staff has already confirmed.
      confidenceScore: wasStored ? 90 : 70,
    })
  );

  return { items, mapping, mappingWasStored: wasStored, headers };
}

type Gstr2bInvoiceItem = { txval?: unknown; iamt?: unknown; camt?: unknown; samt?: unknown };
type Gstr2bInvoice = { inum?: unknown; idt?: unknown; items?: Gstr2bInvoiceItem[] } & Gstr2bInvoiceItem;
type Gstr2bSupplier = { ctin?: unknown; trdnm?: unknown; inv?: Gstr2bInvoice[] };

/**
 * Parses a GSTR-2B JSON export (downloaded from the GST portal). Supports
 * the portal's nested B2B shape (data.docdata.b2b[].inv[]) at high
 * confidence; falls back to treating the JSON as a flat array of records
 * (some GSP tools export it already-flattened) run through the same
 * column-mapping path as CSV/Excel, at lower confidence since that shape
 * isn't guaranteed.
 */
export async function extractGstr2bJson(params: {
  input: ExtractInput;
  source: LineItemSource;
  clientId: string;
}): Promise<{ items: ExtractedRow[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params.input.buffer.toString("utf-8"));
  } catch {
    throw new ExtractionError("Couldn't parse this as JSON — expected a GSTR-2B export from the GST portal.");
  }

  const b2b = (parsed as { data?: { docdata?: { b2b?: Gstr2bSupplier[] } } })?.data?.docdata?.b2b;
  if (Array.isArray(b2b)) {
    const items: ExtractedRow[] = [];
    for (const supplier of b2b) {
      const gstin = normalizeGstin(supplier?.ctin ?? null);
      const invoices = Array.isArray(supplier?.inv) ? supplier.inv : [];
      for (const inv of invoices) {
        const referenceNo = normalizeReferenceNo(inv?.inum ?? null);
        const date = parseDateValue(inv?.idt ?? null);
        const lineItems = Array.isArray(inv?.items) && inv.items.length > 0 ? inv.items : [inv];
        const taxableValue = lineItems.reduce((sum, it) => sum + (parseNumber(it?.txval) ?? 0), 0);
        const taxAmount = lineItems.reduce(
          (sum, it) => sum + (parseNumber(it?.iamt) ?? 0) + (parseNumber(it?.camt) ?? 0) + (parseNumber(it?.samt) ?? 0),
          0
        );
        items.push({
          source: params.source,
          rawRow: inv as Record<string, unknown>,
          normalizedKey: computeNormalizedKey({
            type: "GST_2B_VS_PURCHASE",
            gstin,
            referenceNo,
            date,
            amount: taxableValue,
            direction: null,
          }),
          date,
          amount: taxableValue || null,
          taxAmount: taxAmount || null,
          counterparty: typeof supplier?.trdnm === "string" ? supplier.trdnm : null,
          referenceNo,
          gstin,
          direction: null,
          confidenceScore: 98,
          extractionMethod: "JSON_PARSE",
        });
      }
    }
    if (items.length > 0) return { items };
  }

  // Fallback: flat array of records — reuse the tabular column-mapping path.
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
    const headers = Object.keys(parsed[0] as Record<string, unknown>);
    const { mapping } = await resolveColumnMapping(params.clientId, "gstr2b", headers);
    const items = (parsed as Record<string, unknown>[]).map((record) =>
      mapRawRecordToRow({
        type: "GST_2B_VS_PURCHASE",
        source: params.source,
        record,
        mapping,
        extractionMethod: "JSON_PARSE",
        confidenceScore: 75,
      })
    );
    return { items };
  }

  throw new ExtractionError(
    "Unrecognized GSTR-2B JSON shape — expected the GST portal's export format (data.docdata.b2b) or a flat array of invoice records."
  );
}
