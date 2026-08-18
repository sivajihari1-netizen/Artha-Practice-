import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FeeItem } from "@/lib/quotationPresets";

/** First two digits of a GSTIN are the state code (e.g. "27" = Maharashtra). */
function gstinStateCode(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/**
 * Suggests INTRA (same state — CGST+SGST) vs INTER (different state — IGST)
 * by comparing GSTIN state codes. Returns null when either party has no
 * GSTIN — the firm decides manually in that case (e.g. billing an
 * unregistered individual).
 */
export function suggestGstType(firmGstin: string | null | undefined, clientGstin: string | null | undefined): "INTRA" | "INTER" | null {
  const firmState = gstinStateCode(firmGstin);
  const clientState = gstinStateCode(clientGstin);
  if (!firmState || !clientState) return null;
  return firmState === clientState ? "INTRA" : "INTER";
}

export type InvoiceLineInput = { description: string; quantity: number; rate: number };
export type DiscountType = "PERCENT" | "FLAT" | null | undefined;

/** Discount is applied to the line-item subtotal before GST is computed. */
export function computeInvoiceTotals(
  items: InvoiceLineInput[],
  applyGst: boolean,
  gstRate: number,
  discountType?: DiscountType,
  discountValue = 0
) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.quantity * i.rate, 0));

  let discountAmount = 0;
  if (discountType === "PERCENT") discountAmount = round2(subtotal * (discountValue / 100));
  else if (discountType === "FLAT") discountAmount = round2(discountValue);
  discountAmount = Math.min(discountAmount, subtotal);

  const taxableAmount = round2(subtotal - discountAmount);
  const taxAmount = applyGst ? round2(taxableAmount * (gstRate / 100)) : 0;
  const total = round2(taxableAmount + taxAmount);

  return { subtotal, discountAmount, taxableAmount, taxAmount, total };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Quotation.feeItems -> InvoiceItem line inputs. No other InvoiceItem field exists to carry `frequency`, so it's folded into the description text (e.g. "GST filing (Monthly)") when present. Rows with a blank particulars are dropped rather than creating an empty line item. */
export function mapFeeItemsToInvoiceItems(feeItems: FeeItem[]): InvoiceLineInput[] {
  return feeItems
    .filter((f) => f.particulars.trim().length > 0)
    .map((f) => ({
      description: f.frequency.trim() ? `${f.particulars} (${f.frequency})` : f.particulars,
      quantity: 1,
      rate: f.fee,
    }));
}

type Db = typeof prisma | Prisma.TransactionClient;

export type CreateInvoiceInput = {
  firmId: string;
  clientId: string;
  createdById: string;
  items: InvoiceLineInput[];
  applyGst: boolean;
  gstType?: "INTRA" | "INTER";
  gstRate: number;
  discountType?: DiscountType;
  discountValue?: number;
  dueDate?: Date;
  paymentTerms?: string;
  notes?: string;
  /** Set only when this invoice is being created from an accepted Quotation via "Create Invoice" — see POST /api/quotations/[id]/create-invoice. Omitted (undefined) for every ordinary manually-created invoice. */
  sourceQuotationId?: string;
};

/**
 * The single place an Invoice row + its items get created — extracted from
 * POST /api/invoices so a second call site (Quotation -> Invoice, P1 batch)
 * can reuse the exact same calculation (computeInvoiceTotals), numbering
 * (generateInvoiceNumber), and row shape without duplicating any of it.
 * POST /api/invoices itself now calls this too; its behavior is unchanged —
 * this is a pure extraction, not a rewrite.
 *
 * `db` is accepted (rather than importing the singleton `prisma` directly)
 * so a caller that needs this create to participate in a transaction (e.g.
 * the Quotation route, which also records an Activity in the same unit of
 * work) can pass its `tx` client; the manual invoice route passes the plain
 * `prisma` client, exactly matching its behavior before this extraction.
 */
export async function createInvoiceRecord(db: Db, input: CreateInvoiceInput) {
  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(
    input.items,
    input.applyGst,
    input.gstRate,
    input.discountType,
    input.discountValue ?? 0
  );
  const invoiceNumber = await generateInvoiceNumber(input.firmId);

  return db.invoice.create({
    data: {
      firmId: input.firmId,
      clientId: input.clientId,
      invoiceNumber,
      applyGst: input.applyGst,
      gstType: input.applyGst ? input.gstType ?? null : null,
      gstRate: input.gstRate,
      discountType: discountAmount > 0 ? input.discountType ?? null : null,
      discountValue: discountAmount > 0 ? input.discountValue ?? 0 : 0,
      discountAmount,
      subtotal,
      taxAmount,
      total,
      dueDate: input.dueDate,
      paymentTerms: input.paymentTerms,
      notes: input.notes,
      publicToken: generatePublicToken(),
      createdById: input.createdById,
      sourceQuotationId: input.sourceQuotationId ?? null,
      items: { create: input.items.map((i) => ({ description: i.description, quantity: i.quantity, rate: i.rate, amount: i.quantity * i.rate })) },
    },
    include: { items: true, client: { select: { name: true } } },
  });
}

/** "2025-26" style Indian financial year (April–March) for a given date. */
export function indianFinancialYear(date: Date): string {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? y : y - 1; // April = month index 3
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Unguessable token used for the read-only public invoice share link. */
export function generatePublicToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** A UPI deep link that opens any UPI app with the payee, amount, and note pre-filled. */
export function buildUpiLink(params: { upiId: string; payeeName: string; amount: number; note: string }): string {
  const { upiId, payeeName, amount, note } = params;
  const search = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${search.toString()}`;
}

/** "INV/2026-27/0001" — sequential per firm per Indian financial year. */
export async function generateInvoiceNumber(firmId: string, now: Date = new Date()): Promise<string> {
  const fy = indianFinancialYear(now);
  const prefix = `INV/${fy}/`;
  const count = await prisma.invoice.count({
    where: { firmId, invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? ` ${ONES[ones]}` : "");
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return (hundreds ? `${ONES[hundreds]} Hundred${rest ? " " : ""}` : "") + (rest ? twoDigitsToWords(rest) : "");
}

/** Converts a rupee amount to words using the Indian numbering system (lakh/crore). */
export function amountToWordsInr(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1_000);
  const hundred = rupees % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  let words = `Rupees ${parts.join(" ")}`;
  if (paise) words += ` and ${twoDigitsToWords(paise)} Paise`;
  return `${words} Only`;
}
