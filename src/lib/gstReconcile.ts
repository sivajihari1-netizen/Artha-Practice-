import Papa from "papaparse";

// Manual GST reconciliation: matches a client's purchase register against
// their GSTR-2B export, both as CSV (see README for export instructions —
// deliberately CSV-only, not the GSTR-2B JSON/API, to avoid GSP/ASP
// integration and to avoid parsing untrusted binary spreadsheet formats).

export type ReconRow = {
  supplierGstin: string | null;
  invoiceNumber: string;
  invoiceDate: string | null; // ISO date or null if unparseable
  taxableValue: number | null;
  taxAmount: number | null;
};

const GSTIN_ALIASES = ["gstin", "supplier gstin", "gstin of supplier", "supplier gstin/uin"];
const INVOICE_NO_ALIASES = ["invoice number", "invoice no", "inv no", "invoice no.", "document number", "doc no"];
const INVOICE_DATE_ALIASES = ["invoice date", "inv date", "document date", "doc date"];
const TAXABLE_VALUE_ALIASES = ["taxable value", "taxable value (rs.)", "taxable amount", "taxable value(rs)"];
const TAX_AMOUNT_ALIASES = ["tax amount", "total tax", "total tax amount"];
const TAX_COMPONENT_ALIASES = ["igst", "cgst", "sgst", "sgst/utgst", "cess"];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  // Common Indian export formats: DD-MM-YYYY, DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const iso = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export class GstCsvParseError extends Error {}

export function parseGstCsv(text: string): ReconRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new GstCsvParseError("Could not parse CSV file — check it's a valid CSV export.");
  }
  if (result.data.length === 0) {
    throw new GstCsvParseError("CSV file has no data rows.");
  }

  const headers = result.meta.fields ?? [];
  const gstinCol = findColumn(headers, GSTIN_ALIASES);
  const invoiceNoCol = findColumn(headers, INVOICE_NO_ALIASES);
  const invoiceDateCol = findColumn(headers, INVOICE_DATE_ALIASES);
  const taxableValueCol = findColumn(headers, TAXABLE_VALUE_ALIASES);
  const taxAmountCol = findColumn(headers, TAX_AMOUNT_ALIASES);
  const taxComponentCols = TAX_COMPONENT_ALIASES.map((alias) => findColumn(headers, [alias])).filter(
    (c): c is string => c !== null
  );

  if (!invoiceNoCol) {
    throw new GstCsvParseError(
      "Couldn't find an invoice number column. Expected a header like 'Invoice Number' or 'Invoice No'."
    );
  }

  return result.data
    .filter((row) => row[invoiceNoCol]?.trim())
    .map((row) => {
      let taxAmount: number | null = null;
      if (taxAmountCol) {
        taxAmount = parseNumber(row[taxAmountCol]);
      } else if (taxComponentCols.length > 0) {
        const sum = taxComponentCols.reduce((acc, col) => acc + (parseNumber(row[col]) ?? 0), 0);
        taxAmount = sum;
      }
      return {
        supplierGstin: gstinCol ? (row[gstinCol]?.trim().toUpperCase() || null) : null,
        invoiceNumber: row[invoiceNoCol].trim().toUpperCase(),
        invoiceDate: invoiceDateCol ? parseDate(row[invoiceDateCol]) : null,
        taxableValue: taxableValueCol ? parseNumber(row[taxableValueCol]) : null,
        taxAmount,
      };
    });
}

export type ReconItemResult = ReconRow & {
  taxableValue2b: number | null;
  taxableValueBooks: number | null;
  taxAmount2b: number | null;
  taxAmountBooks: number | null;
  status: "MATCHED" | "ONLY_IN_2B" | "ONLY_IN_BOOKS" | "MISMATCH";
};

const AMOUNT_TOLERANCE = 1; // rupees — ignore rounding differences

function matchKey(row: ReconRow): string {
  return `${row.supplierGstin ?? ""}::${row.invoiceNumber}`;
}

function amountsDiffer(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) > AMOUNT_TOLERANCE;
}

export function reconcile(
  booksRows: ReconRow[],
  gstr2bRows: ReconRow[]
): { items: ReconItemResult[]; summary: { matched: number; onlyIn2b: number; onlyInBooks: number; mismatch: number } } {
  const booksByKey = new Map(booksRows.map((r) => [matchKey(r), r]));
  const gstr2bByKey = new Map(gstr2bRows.map((r) => [matchKey(r), r]));

  const allKeys = new Set([...booksByKey.keys(), ...gstr2bByKey.keys()]);
  const items: ReconItemResult[] = [];
  const summary = { matched: 0, onlyIn2b: 0, onlyInBooks: 0, mismatch: 0 };

  for (const key of allKeys) {
    const book = booksByKey.get(key);
    const gst = gstr2bByKey.get(key);

    if (book && !gst) {
      items.push({
        ...book,
        taxableValue2b: null,
        taxableValueBooks: book.taxableValue,
        taxAmount2b: null,
        taxAmountBooks: book.taxAmount,
        status: "ONLY_IN_BOOKS",
      });
      summary.onlyInBooks++;
    } else if (gst && !book) {
      items.push({
        ...gst,
        taxableValue2b: gst.taxableValue,
        taxableValueBooks: null,
        taxAmount2b: gst.taxAmount,
        taxAmountBooks: null,
        status: "ONLY_IN_2B",
      });
      summary.onlyIn2b++;
    } else if (book && gst) {
      const mismatch = amountsDiffer(book.taxableValue, gst.taxableValue) || amountsDiffer(book.taxAmount, gst.taxAmount);
      items.push({
        ...gst,
        invoiceDate: gst.invoiceDate ?? book.invoiceDate,
        taxableValue2b: gst.taxableValue,
        taxableValueBooks: book.taxableValue,
        taxAmount2b: gst.taxAmount,
        taxAmountBooks: book.taxAmount,
        status: mismatch ? "MISMATCH" : "MATCHED",
      });
      if (mismatch) summary.mismatch++;
      else summary.matched++;
    }
  }

  items.sort((a, b) => (a.status === b.status ? a.invoiceNumber.localeCompare(b.invoiceNumber) : a.status.localeCompare(b.status)));
  return { items, summary };
}
