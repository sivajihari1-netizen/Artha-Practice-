// MATCH + CLASSIFY steps (spec sections 4 & 5) — deterministic matching
// only, no embeddings/vector search. Every row in itemsA/itemsB ends up in
// exactly one MatchResult (matched or exception) — nothing is silently
// dropped, per the spec's audit-trail requirement.

import type { ExceptionReason, ExtractedRow, MatchResult, MatchType, ReconciliationType } from "./types";

export type MatchTolerance = {
  amountRupees: number; // absolute tolerance in currency units
  amountPercent: number; // e.g. 0.001 = 0.1%
  dateDaysGst: number; // GST: exact date match by default
  dateDaysBank: number; // bank: entries can clear late — wider window
  narrationSimilarityThreshold: number; // 0-1, token-overlap similarity
};

export const DEFAULT_TOLERANCE: MatchTolerance = {
  amountRupees: 1,
  amountPercent: 0.001,
  dateDaysGst: 0,
  dateDaysBank: 3,
  narrationSimilarityThreshold: 0.6,
};

function amountsWithinTolerance(a: number, b: number, tolerance: MatchTolerance): boolean {
  const diff = Math.abs(a - b);
  const pctThreshold = Math.max(Math.abs(a), Math.abs(b)) * tolerance.amountPercent;
  return diff <= Math.max(tolerance.amountRupees, pctThreshold);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

/** Token-set (Jaccard) similarity for narration matching — same lightweight approach as columnMapping.ts, no fuzzy-string dependency. */
export function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    );
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  return intersection / new Set([...tokensA, ...tokensB]).size;
}

function detectDuplicateIndices(items: ExtractedRow[]): Set<number> {
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  items.forEach((item, i) => {
    if (seen.has(item.normalizedKey)) {
      duplicates.add(i);
    } else {
      seen.add(item.normalizedKey);
    }
  });
  return duplicates;
}

/** A matched pair whose amount/tax/date differ beyond tolerance becomes an exception rather than a clean match — spec's Pass 6, folded in here rather than as a separate post-pass. */
function classifyPair(itemA: ExtractedRow, itemB: ExtractedRow, matchType: MatchType, confidence: number, tolerance: MatchTolerance): MatchResult {
  const reasons: ExceptionReason[] = [];

  if (itemA.gstin && itemB.gstin && itemA.gstin !== itemB.gstin) reasons.push("GSTIN_MISMATCH");
  if (itemA.amount !== null && itemB.amount !== null && !amountsWithinTolerance(itemA.amount, itemB.amount, tolerance)) {
    reasons.push("AMOUNT_MISMATCH");
  }
  if (itemA.taxAmount !== null && itemB.taxAmount !== null && !amountsWithinTolerance(itemA.taxAmount, itemB.taxAmount, tolerance)) {
    reasons.push("RATE_MISMATCH");
  }
  if (itemA.date && itemB.date) {
    const maxDays = matchType === "FUZZY" ? tolerance.dateDaysBank : tolerance.dateDaysGst;
    if (daysBetween(itemA.date, itemB.date) > maxDays) reasons.push("DATE_MISMATCH");
  }

  if (reasons.length === 0) {
    return { rowA: itemA, rowB: itemB, matchType, matchConfidence: confidence, status: "MATCHED", exceptionReason: null };
  }
  // GSTIN mismatch (wrong party entirely) is the most severe — takes priority when several reasons apply.
  const reason = reasons.includes("GSTIN_MISMATCH") ? "GSTIN_MISMATCH" : reasons[0];
  return { rowA: itemA, rowB: itemB, matchType, matchConfidence: confidence, status: "EXCEPTION", exceptionReason: reason };
}

export function match(params: {
  type: ReconciliationType;
  itemsA: ExtractedRow[];
  itemsB: ExtractedRow[];
  tolerance?: Partial<MatchTolerance>;
}): MatchResult[] {
  const tolerance: MatchTolerance = { ...DEFAULT_TOLERANCE, ...params.tolerance };
  const { type, itemsA, itemsB } = params;
  const results: MatchResult[] = [];
  const usedA = new Set<number>();
  const usedB = new Set<number>();

  // Pass 0 — same-side duplicates (two rows in one file sharing a match key)
  // never get cross-matched; flag them directly.
  detectDuplicateIndices(itemsA).forEach((i) => {
    usedA.add(i);
    results.push({ rowA: itemsA[i], rowB: null, matchType: "MANUAL", matchConfidence: 0, status: "EXCEPTION", exceptionReason: "DUPLICATE" });
  });
  detectDuplicateIndices(itemsB).forEach((j) => {
    usedB.add(j);
    results.push({ rowA: null, rowB: itemsB[j], matchType: "MANUAL", matchConfidence: 0, status: "EXCEPTION", exceptionReason: "DUPLICATE" });
  });

  // Pass 1 — exact key match.
  const byKeyA = new Map<string, number[]>();
  itemsA.forEach((item, i) => {
    if (usedA.has(i)) return;
    const arr = byKeyA.get(item.normalizedKey) ?? [];
    arr.push(i);
    byKeyA.set(item.normalizedKey, arr);
  });
  itemsB.forEach((itemB, j) => {
    if (usedB.has(j)) return;
    const candidates = byKeyA.get(itemB.normalizedKey) ?? [];
    const i = candidates.find((idx) => !usedA.has(idx));
    if (i === undefined) return;
    usedA.add(i);
    usedB.add(j);
    results.push(classifyPair(itemsA[i], itemB, "EXACT", 100, tolerance));
  });

  // Pass 2 — near match: same reference number (GST recon) or same-day window (bank recon) + amount within tolerance.
  // GST recon anchors on the invoice/reference number rather than GSTIN — Pass 1 already
  // caught every pair where both agree, so anything reaching Pass 2 with a matching
  // reference number is exactly the case where the GSTIN itself might be the mismatch
  // (a typo'd or wrong supplier GSTIN in one side) — classifyPair below is what turns
  // that into a GSTIN_MISMATCH exception instead of two independent "missing" rows.
  itemsA.forEach((itemA, i) => {
    if (usedA.has(i)) return;
    let bestJ = -1;
    let bestScore = -1;
    itemsB.forEach((itemB, j) => {
      if (usedB.has(j)) return;
      if (type === "BANK_VS_BOOKS") {
        if (!itemA.date || !itemB.date || daysBetween(itemA.date, itemB.date) > tolerance.dateDaysBank) return;
      } else {
        if (!itemA.referenceNo || itemA.referenceNo !== itemB.referenceNo) return;
      }
      if (itemA.amount === null || itemB.amount === null) return;
      if (!amountsWithinTolerance(itemA.amount, itemB.amount, tolerance)) return;
      const deviationPct = itemA.amount === 0 ? 0 : Math.abs(itemA.amount - itemB.amount) / Math.abs(itemA.amount);
      const score = Math.max(50, Math.round(100 - deviationPct * 100));
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    });
    if (bestJ !== -1) {
      usedA.add(i);
      usedB.add(bestJ);
      results.push(classifyPair(itemA, itemsB[bestJ], "FUZZY", bestScore, tolerance));
    }
  });

  // Pass 3 — fuzzy text match (bank recon only): same amount + date within tolerance + narration similarity.
  if (type === "BANK_VS_BOOKS") {
    itemsA.forEach((itemA, i) => {
      if (usedA.has(i)) return;
      let bestJ = -1;
      let bestSim = -1;
      itemsB.forEach((itemB, j) => {
        if (usedB.has(j)) return;
        if (itemA.amount === null || itemB.amount === null || itemA.amount !== itemB.amount) return;
        if (!itemA.date || !itemB.date || daysBetween(itemA.date, itemB.date) > tolerance.dateDaysBank) return;
        const sim = textSimilarity(itemA.counterparty ?? "", itemB.counterparty ?? "");
        if (sim > tolerance.narrationSimilarityThreshold && sim > bestSim) {
          bestSim = sim;
          bestJ = j;
        }
      });
      if (bestJ !== -1) {
        usedA.add(i);
        usedB.add(bestJ);
        results.push(classifyPair(itemA, itemsB[bestJ], "FUZZY", Math.round(bestSim * 100), tolerance));
      }
    });
  }

  // Pass 4 — left in A, unmatched: source A is always the external document (GSTR-2B/1,
  // bank statement — see extract.ts/pipeline.ts). Present there but not in books.
  itemsA.forEach((itemA, i) => {
    if (usedA.has(i)) return;
    results.push({ rowA: itemA, rowB: null, matchType: "MANUAL", matchConfidence: 0, status: "EXCEPTION", exceptionReason: "MISSING_IN_BOOKS" });
  });

  // Pass 5 — left in B, unmatched: source B is always books (purchase/sales register, ledger).
  // Present in books but not in the external source — e.g. supplier hasn't filed it yet.
  itemsB.forEach((itemB, j) => {
    if (usedB.has(j)) return;
    results.push({ rowA: null, rowB: itemB, matchType: "MANUAL", matchConfidence: 0, status: "EXCEPTION", exceptionReason: "MISSING_IN_SOURCE" });
  });

  return results;
}
