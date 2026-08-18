import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoiceCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { count: (...a: unknown[]) => mockInvoiceCount(...a) } },
}));

import { computeInvoiceTotals, createInvoiceRecord, mapFeeItemsToInvoiceItems } from "./invoice";

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoiceCount.mockResolvedValue(0);
});

describe("mapFeeItemsToInvoiceItems — Quotation.feeItems -> InvoiceItem line inputs (P1 batch)", () => {
  it("maps particulars -> description, fee -> rate, quantity always 1", () => {
    const result = mapFeeItemsToInvoiceItems([{ particulars: "GST filing", fee: 5000, frequency: "" }]);
    expect(result).toEqual([{ description: "GST filing", quantity: 1, rate: 5000 }]);
  });

  it("appends frequency to the description in parentheses when present", () => {
    const result = mapFeeItemsToInvoiceItems([{ particulars: "GST filing", fee: 5000, frequency: "Monthly" }]);
    expect(result[0].description).toBe("GST filing (Monthly)");
  });

  it("drops rows with a blank particulars rather than creating an empty line item", () => {
    const result = mapFeeItemsToInvoiceItems([
      { particulars: "  ", fee: 1000, frequency: "" },
      { particulars: "ROC filing", fee: 2000, frequency: "Annual" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("ROC filing (Annual)");
  });

  it("maps every row, in order", () => {
    const result = mapFeeItemsToInvoiceItems([
      { particulars: "Incorporation", fee: 15000, frequency: "One-time" },
      { particulars: "Virtual CFO", fee: 8000, frequency: "Monthly" },
    ]);
    expect(result.map((r) => r.description)).toEqual(["Incorporation (One-time)", "Virtual CFO (Monthly)"]);
  });
});

describe("createInvoiceRecord — the single Invoice-creation function shared by both call sites (P1 batch)", () => {
  it("computes totals via computeInvoiceTotals — never reimplements the math", async () => {
    const items = [{ description: "GST filing", quantity: 1, rate: 5000 }];
    const mockCreate = vi.fn().mockResolvedValue({ id: "inv_1", invoiceNumber: "INV/2026-27/0001", total: 5900 });
    const fakeDb = { invoice: { create: mockCreate } } as never;

    await createInvoiceRecord(fakeDb, {
      firmId: "firm_1",
      clientId: "client_1",
      createdById: "user_1",
      items,
      applyGst: true,
      gstType: "INTRA",
      gstRate: 18,
    });

    const expected = computeInvoiceTotals(items, true, 18, undefined, 0);
    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.subtotal).toBe(expected.subtotal);
    expect(callData.taxAmount).toBe(expected.taxAmount);
    expect(callData.total).toBe(expected.total);
  });

  it("passes sourceQuotationId through when given (Quotation -> Invoice path)", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: "inv_1" });
    const fakeDb = { invoice: { create: mockCreate } } as never;

    await createInvoiceRecord(fakeDb, {
      firmId: "firm_1",
      clientId: "client_1",
      createdById: "user_1",
      items: [{ description: "x", quantity: 1, rate: 100 }],
      applyGst: false,
      gstRate: 18,
      sourceQuotationId: "quo_1",
    });

    expect(mockCreate.mock.calls[0][0].data.sourceQuotationId).toBe("quo_1");
  });

  it("defaults sourceQuotationId to null for a manually-created invoice (no quotation involved)", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: "inv_1" });
    const fakeDb = { invoice: { create: mockCreate } } as never;

    await createInvoiceRecord(fakeDb, {
      firmId: "firm_1",
      clientId: "client_1",
      createdById: "user_1",
      items: [{ description: "x", quantity: 1, rate: 100 }],
      applyGst: false,
      gstRate: 18,
    });

    expect(mockCreate.mock.calls[0][0].data.sourceQuotationId).toBeNull();
  });

  it("creates items via the same quantity*rate=amount shape as before extraction", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: "inv_1" });
    const fakeDb = { invoice: { create: mockCreate } } as never;

    await createInvoiceRecord(fakeDb, {
      firmId: "firm_1",
      clientId: "client_1",
      createdById: "user_1",
      items: [{ description: "GST filing", quantity: 2, rate: 1500 }],
      applyGst: false,
      gstRate: 18,
    });

    expect(mockCreate.mock.calls[0][0].data.items.create).toEqual([
      { description: "GST filing", quantity: 2, rate: 1500, amount: 3000 },
    ]);
  });

  it("uses generateInvoiceNumber() for numbering — never a second numbering scheme", async () => {
    mockInvoiceCount.mockResolvedValue(4);
    const mockCreate = vi.fn().mockResolvedValue({ id: "inv_1" });
    const fakeDb = { invoice: { create: mockCreate } } as never;

    await createInvoiceRecord(fakeDb, {
      firmId: "firm_1",
      clientId: "client_1",
      createdById: "user_1",
      items: [{ description: "x", quantity: 1, rate: 100 }],
      applyGst: false,
      gstRate: 18,
    });

    expect(mockCreate.mock.calls[0][0].data.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/0005$/);
  });
});
