import { describe, expect, it } from "vitest";
import { match } from "./match";
import { computeNormalizedKey, normalizeGstin, normalizeReferenceNo } from "./normalize";
import type { ExtractedRow, LineItemSource, ReconciliationType } from "./types";

// In production, ExtractedRow.gstin/referenceNo are always already normalized —
// mapRawRecordToRow (normalize.ts) does it before a row exists at all. Route the
// fixture's fields through the same normalizers so tests can pass in "raw" values
// (mixed case, unnormalized zeros) and get realistic already-normalized rows back,
// exactly as the real extraction pipeline would produce.
function row(source: LineItemSource, type: ReconciliationType, overrides: Partial<ExtractedRow> = {}): ExtractedRow {
  const base: ExtractedRow = {
    source,
    rawRow: {},
    normalizedKey: "",
    date: "2026-06-15T00:00:00.000Z",
    amount: 10000,
    taxAmount: 1800,
    counterparty: "Acme Supplies Pvt Ltd",
    referenceNo: "INV-0001",
    gstin: "27AAAPL1234C1ZV",
    direction: null,
    confidenceScore: 95,
    extractionMethod: "CSV_PARSE",
    ...overrides,
  };
  base.gstin = normalizeGstin(base.gstin);
  base.referenceNo = normalizeReferenceNo(base.referenceNo);
  base.normalizedKey = computeNormalizedKey({
    type,
    gstin: base.gstin,
    referenceNo: base.referenceNo,
    date: base.date,
    amount: base.amount,
    direction: base.direction,
  });
  return base;
}

describe("match — GST reconciliation (2B vs purchase register)", () => {
  const type: ReconciliationType = "GST_2B_VS_PURCHASE";

  it("matches identical invoices exactly", () => {
    const a = row("A", type);
    const b = row("B", type);
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("MATCHED");
    expect(results[0].matchType).toBe("EXACT");
    expect(results[0].matchConfidence).toBe(100);
  });

  it("is case-insensitive on invoice number and GSTIN", () => {
    const a = row("A", type, { referenceNo: "inv-0001", gstin: "27aaapl1234c1zv" });
    const b = row("B", type, { referenceNo: "INV-0001", gstin: "27AAAPL1234C1ZV" });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("MATCHED");
  });

  it("strips leading zeros from a purely numeric invoice number before matching", () => {
    const a = row("A", type, { referenceNo: "007" });
    const b = row("B", type, { referenceNo: "7" });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("MATCHED");
  });

  it("accepts amount differences within the ₹1 / 0.1% tolerance as a clean match", () => {
    const a = row("A", type, { amount: 10000.5 });
    const b = row("B", type, { amount: 10000 });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results[0].status).toBe("MATCHED");
  });

  it("flags an amount difference beyond tolerance as AMOUNT_MISMATCH", () => {
    const a = row("A", type, { amount: 10500 });
    const b = row("B", type, { amount: 10000 });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("AMOUNT_MISMATCH");
  });

  it("flags a tax-amount difference beyond tolerance as RATE_MISMATCH", () => {
    const a = row("A", type, { taxAmount: 2200 });
    const b = row("B", type, { taxAmount: 1800 });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("RATE_MISMATCH");
  });

  it("flags a date difference beyond the (zero-day default) tolerance as DATE_MISMATCH", () => {
    const a = row("A", type, { date: "2026-06-15T00:00:00.000Z" });
    const b = row("B", type, { date: "2026-06-20T00:00:00.000Z" });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("DATE_MISMATCH");
  });

  it("catches a GSTIN mismatch on an otherwise-identical invoice via the reference-number-anchored near-match pass", () => {
    const a = row("A", type, { gstin: "27AAAPL1234C1ZV" });
    const b = row("B", type, { gstin: "29AAAPL1234C1ZX" }); // same invoice number, different GSTIN
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("GSTIN_MISMATCH");
    expect(results[0].matchType).toBe("FUZZY");
  });

  it("GSTIN mismatch takes priority when it coincides with a small (in-tolerance) amount difference", () => {
    const a = row("A", type, { gstin: "27AAAPL1234C1ZV", amount: 10000.5 });
    const b = row("B", type, { gstin: "29AAAPL1234C1ZX", amount: 10000 });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].exceptionReason).toBe("GSTIN_MISMATCH");
  });

  it("a GSTIN mismatch combined with an out-of-tolerance amount difference can't be distinguished from two unrelated invoices, so it surfaces as two independent missing-side exceptions rather than a guessed pairing", () => {
    const a = row("A", type, { gstin: "27AAAPL1234C1ZV", amount: 10500 });
    const b = row("B", type, { gstin: "29AAAPL1234C1ZX", amount: 10000 });
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.exceptionReason).sort()).toEqual(["MISSING_IN_BOOKS", "MISSING_IN_SOURCE"]);
  });

  it("flags an invoice present only in GSTR-2B (side A) as MISSING_IN_BOOKS", () => {
    const a = row("A", type, { referenceNo: "INV-9999" });
    const results = match({ type, itemsA: [a], itemsB: [] });

    expect(results).toHaveLength(1);
    expect(results[0].rowA).not.toBeNull();
    expect(results[0].rowB).toBeNull();
    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("MISSING_IN_BOOKS");
  });

  it("flags an invoice present only in the purchase register (side B) as MISSING_IN_SOURCE", () => {
    const b = row("B", type, { referenceNo: "INV-8888" });
    const results = match({ type, itemsA: [], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].rowA).toBeNull();
    expect(results[0].rowB).not.toBeNull();
    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("MISSING_IN_SOURCE");
  });

  it("flags a duplicate match key within the same file as DUPLICATE, without pairing it against the other side", () => {
    const a1 = row("A", type, { referenceNo: "INV-0001" });
    const a2 = row("A", type, { referenceNo: "INV-0001" }); // duplicate entry in the same GSTR-2B export
    const b = row("B", type, { referenceNo: "INV-0001" });
    const results = match({ type, itemsA: [a1, a2], itemsB: [b] });

    // one clean match (a1 <-> b) plus one duplicate exception (a2)
    expect(results).toHaveLength(2);
    const duplicate = results.find((r) => r.exceptionReason === "DUPLICATE");
    const clean = results.find((r) => r.status === "MATCHED");
    expect(duplicate).toBeDefined();
    expect(clean).toBeDefined();
  });

  it("never drops a row — every input row appears in exactly one result", () => {
    const itemsA = [
      row("A", type, { referenceNo: "INV-0001" }),
      row("A", type, { referenceNo: "INV-0002", amount: 5000 }),
      row("A", type, { referenceNo: "INV-0003" }), // will be missing_in_books
    ];
    const itemsB = [
      row("B", type, { referenceNo: "INV-0001" }),
      row("B", type, { referenceNo: "INV-0002", amount: 5200 }), // amount mismatch
      row("B", type, { referenceNo: "INV-0004" }), // will be missing_in_source
    ];
    const results = match({ type, itemsA, itemsB });

    const seenA = results.filter((r) => r.rowA).map((r) => r.rowA!.referenceNo);
    const seenB = results.filter((r) => r.rowB).map((r) => r.rowB!.referenceNo);
    expect(seenA.sort()).toEqual(["INV-0001", "INV-0002", "INV-0003"]);
    expect(seenB.sort()).toEqual(["INV-0001", "INV-0002", "INV-0004"]);
  });
});

describe("match — bank reconciliation (bank statement vs books)", () => {
  const type: ReconciliationType = "BANK_VS_BOOKS";

  function bankRow(source: LineItemSource, overrides: Partial<ExtractedRow> = {}) {
    return row(source, type, {
      gstin: null,
      referenceNo: null,
      counterparty: "NEFT FROM ACME SUPPLIES PVT LTD",
      direction: "credit",
      amount: 25000,
      taxAmount: null,
      ...overrides,
    });
  }

  it("matches identical date+amount+direction exactly", () => {
    const a = bankRow("A");
    const b = bankRow("B");
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results[0].status).toBe("MATCHED");
    expect(results[0].matchType).toBe("EXACT");
  });

  it("matches an entry that cleared a few days late via the date-window near-match pass", () => {
    const a = bankRow("A", { date: "2026-06-15T00:00:00.000Z" });
    const b = bankRow("B", { date: "2026-06-17T00:00:00.000Z" }); // 2 days later, within ±3 day tolerance
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("MATCHED");
    expect(results[0].matchType).toBe("FUZZY");
  });

  it("uses narration similarity to match same-amount, same-day entries whose exact key differs", () => {
    const a = bankRow("A", { counterparty: "NEFT FROM ACME SUPPLIES PVT LTD", direction: "credit" });
    const b = bankRow("B", { counterparty: "Being amount received from Acme Supplies", direction: "debit" }); // ledger narration differs, direction recorded oppositely — still same real transaction
    const results = match({ type, itemsA: [a], itemsB: [b] });

    expect(results).toHaveLength(1);
    // direction differs -> not an exact-key match, and Pass 2's date-window+amount-tolerance
    // near-match would also pair it (same amount, same day) — either way it should resolve to
    // one paired result, not two independent missing entries.
    expect(results[0].rowA).not.toBeNull();
    expect(results[0].rowB).not.toBeNull();
  });

  it("flags an unmatched debit as an exception, not a silent drop", () => {
    const a = bankRow("A", { direction: "debit", amount: 999, date: "2026-01-01T00:00:00.000Z" });
    const results = match({ type, itemsA: [a], itemsB: [] });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("EXCEPTION");
    expect(results[0].exceptionReason).toBe("MISSING_IN_BOOKS");
  });
});
