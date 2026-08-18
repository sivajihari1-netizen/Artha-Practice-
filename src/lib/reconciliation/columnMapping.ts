// Column-mapping step (spec section 4a): books/bank exports never have
// standard column names, so on first upload from a client we auto-detect
// columns by header similarity against known aliases, then let staff
// confirm/correct once — after which the mapping is remembered per
// client+sourceType and reused on every future upload, so a client's
// monthly export never needs re-mapping.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { NormalizedField } from "./types";

export type ReconciliationSourceType = "purchase_register" | "sales_register" | "bank_ledger" | "gstr2b" | "gstr1";

export type ColumnMap = Partial<Record<NormalizedField, string>>;

const FIELD_ALIASES: Record<NormalizedField, string[]> = {
  gstin: ["gstin", "supplier gstin", "gstin of supplier", "supplier gstin/uin", "buyer gstin", "gstin/uin of recipient", "recipient gstin"],
  referenceNo: [
    "invoice number", "invoice no", "inv no", "invoice no.", "document number", "doc no",
    "voucher no", "bill no", "cheque no", "cheque no.", "chq no", "utr", "reference no",
    "ref no", "ref no.", "transaction id", "txn id", "narration id",
  ],
  date: ["invoice date", "inv date", "document date", "doc date", "date", "voucher date", "value date", "txn date", "transaction date"],
  amount: [
    "taxable value", "taxable value (rs.)", "taxable amount", "taxable value(rs)",
    "amount", "transaction amount", "amount (inr)", "amount(inr)",
  ],
  taxAmount: ["tax amount", "total tax", "total tax amount"],
  counterparty: ["supplier name", "buyer name", "party name", "vendor name", "narration", "description", "particulars", "counterparty"],
  direction: ["dr/cr", "type", "transaction type", "cr/dr"],
  debitAmount: ["withdrawal amt.", "withdrawal amt", "debit", "debit amount", "withdrawal", "dr amount"],
  creditAmount: ["deposit amt.", "deposit amt", "credit", "credit amount", "deposit", "cr amount"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Token-overlap (Jaccard) similarity — no external fuzzy-matching dependency needed for header aliasing. */
function headerSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const tokensA = new Set(a.split(/[\s._-]+/).filter(Boolean));
  const tokensB = new Set(b.split(/[\s._-]+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

const AUTO_DETECT_THRESHOLD = 0.5;

/** Best-effort mapping from a file's actual headers to normalized fields — the starting point staff confirms/corrects. */
export function autoDetectColumnMapping(headers: string[]): ColumnMap {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMap = {};

  for (const field of Object.keys(FIELD_ALIASES) as NormalizedField[]) {
    let best: { header: string; score: number } | null = null;
    for (let i = 0; i < normalized.length; i++) {
      for (const alias of FIELD_ALIASES[field]) {
        const score = normalized[i] === alias ? 1 : headerSimilarity(normalized[i], alias);
        if (score >= AUTO_DETECT_THRESHOLD && (!best || score > best.score)) {
          best = { header: headers[i], score };
        }
      }
    }
    if (best) mapping[field] = best.header;
  }
  return mapping;
}

export async function getStoredColumnMapping(clientId: string, sourceType: ReconciliationSourceType) {
  const row = await prisma.reconciliationColumnMapping.findUnique({
    where: { clientId_sourceType: { clientId, sourceType } },
  });
  return row ? (row.mapping as ColumnMap) : null;
}

export function saveColumnMapping(clientId: string, sourceType: ReconciliationSourceType, mapping: ColumnMap) {
  return prisma.reconciliationColumnMapping.upsert({
    where: { clientId_sourceType: { clientId, sourceType } },
    create: { clientId, sourceType, mapping: mapping as Prisma.InputJsonValue },
    update: { mapping: mapping as Prisma.InputJsonValue },
  });
}

/** The mapping actually used for a given upload: the client's confirmed mapping if one is on file, else a fresh auto-detect from this file's headers. */
export async function resolveColumnMapping(
  clientId: string,
  sourceType: ReconciliationSourceType,
  headers: string[]
): Promise<{ mapping: ColumnMap; wasStored: boolean }> {
  const stored = await getStoredColumnMapping(clientId, sourceType);
  if (stored) return { mapping: stored, wasStored: true };
  return { mapping: autoDetectColumnMapping(headers), wasStored: false };
}
