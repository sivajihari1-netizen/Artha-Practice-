// EXPLAIN step (spec section 6) — plain-language "why it doesn't match"
// text, built entirely from templates + already-extracted structured
// values. No LLM call: the exception_reason is already decided
// deterministically by match.ts, so there's no judgment left for a model to
// make here — and the spec is explicit that this step must never let an
// LLM invent a financial claim.

import type { ExceptionReason, ExtractedRow, ReconciliationType } from "./types";
import { booksSourceLabel } from "./types";

function fmtAmount(n: number | null): string {
  return n === null ? "an unknown amount" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("en-IN") : "an unknown date";
}

function pctDiff(a: number, b: number): string {
  if (a === 0) return "n/a";
  return `${Math.round((Math.abs(a - b) / Math.abs(a)) * 1000) / 10}%`;
}

export function explainException(params: {
  type: ReconciliationType;
  reason: ExceptionReason;
  rowA: ExtractedRow | null; // the external source (GSTR-2B/1, bank statement)
  rowB: ExtractedRow | null; // books (purchase/sales register, ledger)
}): string {
  const { type, reason, rowA, rowB } = params;
  const { sourceLabel, booksLabel } = booksSourceLabel(type);
  const ref = rowA?.referenceNo ?? rowB?.referenceNo ?? "an entry with no reference number";
  const counterparty = rowA?.counterparty ?? rowB?.counterparty ?? "an unidentified party";
  const date = fmtDate(rowA?.date ?? rowB?.date ?? null);

  switch (reason) {
    case "MISSING_IN_BOOKS":
      return `${sourceLabel} shows ${ref} from ${counterparty} dated ${date} (${fmtAmount(rowA?.amount ?? null)}), but it isn't recorded in ${booksLabel}. Confirm the transaction and record it, or mark it not applicable.`;

    case "MISSING_IN_SOURCE": {
      const followUp =
        type === "BANK_VS_BOOKS"
          ? "It may not have cleared yet, or was recorded on the wrong date."
          : "The counterparty may not have filed it, or filed it in a different period.";
      return `${booksLabel} has ${ref} from ${counterparty} dated ${date} (${fmtAmount(rowB?.amount ?? null)}), but it wasn't found in ${sourceLabel} for this period. ${followUp}`;
    }

    case "AMOUNT_MISMATCH": {
      const a = rowA?.amount ?? null;
      const b = rowB?.amount ?? null;
      const diff = a !== null && b !== null ? fmtAmount(Math.abs(a - b)) : "an unknown amount";
      const pct = a !== null && b !== null ? pctDiff(a, b) : "n/a";
      return `${ref} from ${counterparty} dated ${date}: ${booksLabel} shows ${fmtAmount(b)}, ${sourceLabel} shows ${fmtAmount(a)} — a difference of ${diff} (${pct}).`;
    }

    case "RATE_MISMATCH":
      return `${ref} from ${counterparty}: tax amount differs — ${booksLabel} shows ${fmtAmount(rowB?.taxAmount ?? null)}, ${sourceLabel} shows ${fmtAmount(rowA?.taxAmount ?? null)}.`;

    case "DATE_MISMATCH":
      return `${ref} from ${counterparty}: dated ${fmtDate(rowB?.date ?? null)} in ${booksLabel} but ${fmtDate(rowA?.date ?? null)} in ${sourceLabel} — outside the configured date tolerance.`;

    case "GSTIN_MISMATCH":
      return `${ref}: GSTIN differs between ${booksLabel} (${rowB?.gstin ?? "not on file"}) and ${sourceLabel} (${rowA?.gstin ?? "not on file"}) — verify this is really the same supplier before proceeding.`;

    case "DUPLICATE":
      return `${ref} from ${counterparty} appears more than once in the same file with the same match key — check for a duplicate entry.`;
  }
}
