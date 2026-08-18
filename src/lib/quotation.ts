import { prisma } from "@/lib/prisma";
import { indianFinancialYear } from "@/lib/invoice";

/** "QUO/2026-27/0001" — sequential per firm per Indian financial year, mirrors generateInvoiceNumber. */
export async function generateQuotationNumber(firmId: string, now: Date = new Date()): Promise<string> {
  const fy = indianFinancialYear(now);
  const prefix = `QUO/${fy}/`;
  const count = await prisma.quotation.count({
    where: { firmId, quotationNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Sums fee items by frequency bucket (e.g. all "Monthly" rows, all "One-time" rows) for a compact summary line. */
export function summarizeFeeItems(feeItems: { fee: number; frequency: string }[]): { frequency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const item of feeItems) {
    totals.set(item.frequency, (totals.get(item.frequency) ?? 0) + item.fee);
  }
  return [...totals.entries()].map(([frequency, total]) => ({ frequency, total }));
}
