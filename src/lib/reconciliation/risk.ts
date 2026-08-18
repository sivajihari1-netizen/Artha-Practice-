// RISK SCORING (spec section 7) — deliberately simple for v1: a weighted
// sum of materiality, exception-reason severity, and whether this
// counterparty/GSTIN has mismatched before.

import type { ExceptionReason } from "./types";

export const DEFAULT_MATERIALITY_THRESHOLD = 50000; // rupees — configurable per client in a future pass
export const DEFAULT_ESCALATION_THRESHOLD = 60; // risk_score above which an exception auto-creates a task — configurable per firm in a future pass

const REASON_WEIGHT: Record<ExceptionReason, number> = {
  MISSING_IN_SOURCE: 0.9, // ITC risk — client loses credit (spec's "missing_in_2b")
  MISSING_IN_BOOKS: 0.5, // income tax risk — expense not recorded
  AMOUNT_MISMATCH: 0.6,
  GSTIN_MISMATCH: 1.0, // highest — wrong party entirely
  DUPLICATE: 0.4,
  DATE_MISMATCH: 0.3, // usually just a clearing/filing-period delay
  RATE_MISMATCH: 0.5,
};

export function computeMaterialityAmount(amountA: number | null, amountB: number | null): number {
  if (amountA !== null && amountB !== null) return Math.abs(amountA - amountB);
  return Math.abs(amountA ?? amountB ?? 0);
}

export function computeRiskScore(params: {
  materialityAmount: number;
  exceptionReason: ExceptionReason | null;
  hasRecurredBefore: boolean;
  materialityThreshold?: number;
}): number {
  if (!params.exceptionReason) return 0; // clean match — no risk
  const threshold = params.materialityThreshold ?? DEFAULT_MATERIALITY_THRESHOLD;
  const materialityScore = Math.min(params.materialityAmount / threshold, 1) * 50;
  const reasonScore = REASON_WEIGHT[params.exceptionReason] * 30;
  const recurrenceScore = params.hasRecurredBefore ? 20 : 0;
  return Math.min(100, Math.round(materialityScore + reasonScore + recurrenceScore));
}
