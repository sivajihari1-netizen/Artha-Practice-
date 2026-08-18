import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockClientFindFirst = vi.fn();
const mockFirmFindUnique = vi.fn();
const mockInvoiceCount = vi.fn();
const mockInvoiceCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: (...a: unknown[]) => mockClientFindFirst(...a) },
    firm: { findUnique: (...a: unknown[]) => mockFirmFindUnique(...a) },
    invoice: {
      count: (...a: unknown[]) => mockInvoiceCount(...a),
      create: (...a: unknown[]) => mockInvoiceCreate(...a),
    },
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

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockClientFindFirst.mockResolvedValue({ id: "client_1", firmId: "firm_1", gstin: "27AAAAA0000A1Z5" });
  mockFirmFindUnique.mockResolvedValue({ id: "firm_1", gstin: "27BBBBB1111B1Z5" });
  mockInvoiceCount.mockResolvedValue(0);
  mockInvoiceCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: "inv_new",
    invoiceNumber: data.invoiceNumber,
    total: data.total,
    ...data,
  }));
});

describe("POST /api/invoices — L/Q: manual creation behaviourally unchanged after the createInvoiceRecord() extraction", () => {
  it("STAFF cannot create invoices", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await POST(req({ clientId: "client_1", items: [{ description: "x", quantity: 1, rate: 100 }] }));
    expect(res.status).toBe(403);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("creates a DRAFT invoice for the given client, with computed totals", async () => {
    const res = await POST(
      req({ clientId: "client_1", items: [{ description: "GST filing", quantity: 1, rate: 10000 }], applyGst: true, gstRate: 18 })
    );
    expect(res.status).toBe(201);
    const call = mockInvoiceCreate.mock.calls[0][0].data;
    expect(call.clientId).toBe("client_1");
    expect(call.firmId).toBe("firm_1");
    expect(call.subtotal).toBe(10000);
    expect(call.taxAmount).toBe(1800);
    expect(call.total).toBe(11800);
  });

  it("suggests GST type from firm/client GSTIN state codes when not explicitly given", async () => {
    await POST(req({ clientId: "client_1", items: [{ description: "x", quantity: 1, rate: 100 }], applyGst: true }));
    // firm state 27, client state 27 -> same state -> INTRA
    expect(mockInvoiceCreate.mock.calls[0][0].data.gstType).toBe("INTRA");
  });

  it("applies a discount before computing GST, matching computeInvoiceTotals exactly", async () => {
    await POST(
      req({
        clientId: "client_1",
        items: [{ description: "x", quantity: 1, rate: 10000 }],
        applyGst: true,
        gstRate: 18,
        discountType: "FLAT",
        discountValue: 1000,
      })
    );
    const call = mockInvoiceCreate.mock.calls[0][0].data;
    expect(call.discountAmount).toBe(1000);
    expect(call.taxAmount).toBe(1620); // (10000-1000)*0.18
    expect(call.total).toBe(10620);
  });

  it("has no sourceQuotationId for a manually-created invoice", async () => {
    await POST(req({ clientId: "client_1", items: [{ description: "x", quantity: 1, rate: 100 }] }));
    expect(mockInvoiceCreate.mock.calls[0][0].data.sourceQuotationId).toBeNull();
  });

  it("uses generateInvoiceNumber() — sequential per firm per financial year", async () => {
    mockInvoiceCount.mockResolvedValue(2);
    await POST(req({ clientId: "client_1", items: [{ description: "x", quantity: 1, rate: 100 }] }));
    expect(mockInvoiceCreate.mock.calls[0][0].data.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/0003$/);
  });

  it("records logAudit + INVOICE_CREATED activity, same as before the extraction", async () => {
    await POST(req({ clientId: "client_1", items: [{ description: "x", quantity: 1, rate: 100 }] }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "invoice.create" }));
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "INVOICE_CREATED" }));
  });

  it("404s for a client that doesn't belong to this firm", async () => {
    mockClientFindFirst.mockResolvedValue(null);
    const res = await POST(req({ clientId: "someone_elses_client", items: [{ description: "x", quantity: 1, rate: 100 }] }));
    expect(res.status).toBe(404);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("rejects a request with no line items, same validation as before", async () => {
    const res = await POST(req({ clientId: "client_1", items: [] }));
    expect(res.status).toBe(400);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });
});
