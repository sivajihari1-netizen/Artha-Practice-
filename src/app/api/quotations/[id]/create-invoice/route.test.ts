import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockQuotationFindFirst = vi.fn();
const mockInvoiceFindFirst = vi.fn();
const mockInvoiceCount = vi.fn();
const mockInvoiceCreate = vi.fn();
const mockTransaction = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quotation: { findFirst: (...a: unknown[]) => mockQuotationFindFirst(...a) },
    invoice: {
      findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a),
      count: (...a: unknown[]) => mockInvoiceCount(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/auditLog", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { INVOICE_CREATED: "INVOICE_CREATED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "MANAGER" as const, email: "m@firm.test" };

const ACCEPTED_QUOTATION = {
  id: "quo_1",
  firmId: "firm_1",
  clientId: "client_1",
  status: "ACCEPTED",
  feeItems: [
    { particulars: "GST filing", fee: 5000, frequency: "Monthly" },
    { particulars: "Incorporation", fee: 15000, frequency: "" },
  ],
  client: { id: "client_1", gstin: "27AAAAA0000A1Z5" },
  firm: { gstin: "27BBBBB1111B1Z5" },
  createdInvoice: null,
};

function req() {
  return new NextRequest("http://localhost/api/quotations/quo_1/create-invoice", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockInvoiceCount.mockResolvedValue(0);
  mockInvoiceCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: "inv_new",
    status: "DRAFT",
    ...data,
  }));
  // $transaction just invokes the callback with a fake tx client whose
  // invoice.create is the same mock, mirroring how createInvoiceRecord is
  // called from inside the real prisma.$transaction in the route.
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ invoice: { create: mockInvoiceCreate } }));
});

describe("POST /api/quotations/[id]/create-invoice", () => {
  it("A. an ACCEPTED quotation with a real client creates a Draft invoice", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invoice.status).toBe("DRAFT");
  });

  it("B. the invoice's clientId is the quotation's own clientId — there is no request body for a browser to supply one from", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    await POST(req(), { params: { id: "quo_1" } });
    expect(mockInvoiceCreate.mock.calls[0][0].data.clientId).toBe("client_1");
  });

  it("C. the invoice's firmId is the session's own firmId, from the already firm-scoped quotation lookup", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    await POST(req(), { params: { id: "quo_1" } });
    expect(mockQuotationFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "quo_1", firmId: "firm_1" } }));
    expect(mockInvoiceCreate.mock.calls[0][0].data.firmId).toBe("firm_1");
  });

  it("D. feeItems map to InvoiceItems: particulars->description (+frequency), fee->rate, quantity=1", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    await POST(req(), { params: { id: "quo_1" } });
    expect(mockInvoiceCreate.mock.calls[0][0].data.items.create).toEqual([
      { description: "GST filing (Monthly)", quantity: 1, rate: 5000, amount: 5000 },
      { description: "Incorporation", quantity: 1, rate: 15000, amount: 15000 },
    ]);
  });

  it("E. totals come from computeInvoiceTotals(), not a reimplementation — 20000 subtotal, 18% GST since both firm and client have GSTINs", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    await POST(req(), { params: { id: "quo_1" } });
    const call = mockInvoiceCreate.mock.calls[0][0].data;
    expect(call.subtotal).toBe(20000);
    expect(call.applyGst).toBe(true);
    expect(call.gstType).toBe("INTRA"); // same state code (27) on both GSTINs
    expect(call.taxAmount).toBe(3600);
    expect(call.total).toBe(23600);
  });

  it("F. a second identical request returns the SAME invoice — never a second one", async () => {
    mockQuotationFindFirst.mockResolvedValue({
      ...ACCEPTED_QUOTATION,
      createdInvoice: { id: "inv_existing", invoiceNumber: "INV/2026-27/0001", status: "DRAFT" },
    });
    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(200); // idempotent success, not 201 (nothing new was created)
    const data = await res.json();
    expect(data.invoice.id).toBe("inv_existing");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("G. a true concurrent race (P2002 on the unique constraint) resolves to the existing invoice, never a raw error", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION); // fast-path check sees nothing yet
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`sourceQuotationId`)", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mockTransaction.mockRejectedValue(p2002);
    mockInvoiceFindFirst.mockResolvedValue({ id: "inv_from_other_request", invoiceNumber: "INV/2026-27/0002", status: "DRAFT" });

    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoice.id).toBe("inv_from_other_request");
    expect(mockInvoiceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { sourceQuotationId: "quo_1" } }));
  });

  it("H. STAFF is rejected — 403, nothing created", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(403);
    expect(mockQuotationFindFirst).not.toHaveBeenCalled();
  });

  it("I. a quotation belonging to another firm 404s (findFirst's own where-clause enforces this)", async () => {
    mockQuotationFindFirst.mockResolvedValue(null);
    const res = await POST(req(), { params: { id: "other_firms_quotation" } });
    expect(res.status).toBe(404);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "SENT", "DECLINED", "EXPIRED"])("J. a %s quotation with no existing invoice is rejected (400)", async (status) => {
    mockQuotationFindFirst.mockResolvedValue({ ...ACCEPTED_QUOTATION, status });
    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(400);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("K. a prospect quotation (clientId null) is rejected cleanly, even if ACCEPTED", async () => {
    mockQuotationFindFirst.mockResolvedValue({ ...ACCEPTED_QUOTATION, clientId: null, client: null });
    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(400);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("N. the INVOICE_CREATED activity metadata includes sourceQuotationId", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    await POST(req(), { params: { id: "quo_1" } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INVOICE_CREATED", metadata: expect.objectContaining({ sourceQuotationId: "quo_1" }) })
    );
  });

  it("O. the created invoice row itself has sourceQuotationId populated", async () => {
    mockQuotationFindFirst.mockResolvedValue(ACCEPTED_QUOTATION);
    await POST(req(), { params: { id: "quo_1" } });
    expect(mockInvoiceCreate.mock.calls[0][0].data.sourceQuotationId).toBe("quo_1");
  });

  it("rejects a quotation whose feeItems are all blank — nothing to invoice", async () => {
    mockQuotationFindFirst.mockResolvedValue({ ...ACCEPTED_QUOTATION, feeItems: [{ particulars: "  ", fee: 0, frequency: "" }] });
    const res = await POST(req(), { params: { id: "quo_1" } });
    expect(res.status).toBe(400);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });
});
