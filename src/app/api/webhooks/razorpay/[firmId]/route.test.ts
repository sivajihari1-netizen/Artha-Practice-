import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFirmFindUnique = vi.fn();
const mockInvoiceFindFirst = vi.fn();
const mockInvoiceUpdate = vi.fn();
const mockUserFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    firm: { findUnique: (...a: unknown[]) => mockFirmFindUnique(...a) },
    invoice: {
      findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a),
      update: (...a: unknown[]) => mockInvoiceUpdate(...a),
    },
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
  },
}));

const mockVerifySignature = vi.fn();
vi.mock("@/lib/razorpayInvoicePayments", () => ({
  verifyFirmWebhookSignature: (...a: unknown[]) => mockVerifySignature(...a),
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/auditLog", () => ({
  logAudit: (...a: unknown[]) => mockLogAudit(...a),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { INVOICE_PAID: "INVOICE_PAID" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { POST } from "./route";

const FIRM_ID = "firm_1";

function req(event: unknown, signature = "valid-sig") {
  return new NextRequest(`http://localhost/api/webhooks/razorpay/${FIRM_ID}`, {
    method: "POST",
    headers: { "x-razorpay-signature": signature },
    body: JSON.stringify(event),
  });
}

function paidEvent(overrides: { invoiceId?: string; paymentId?: string } = {}) {
  return {
    event: "payment_link.paid",
    payload: {
      payment_link: { entity: { reference_id: overrides.invoiceId ?? "invoice_1", id: "plink_1" } },
      payment: { entity: { id: overrides.paymentId ?? "pay_1" } },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFirmFindUnique.mockResolvedValue({ id: FIRM_ID, name: "Test Firm", razorpayWebhookSecretEnc: "enc-secret" });
  mockVerifySignature.mockReturnValue(true);
  mockUserFindMany.mockResolvedValue([{ email: "partner@firm.test" }]);
  mockSendEmail.mockResolvedValue({ ok: true });
  mockInvoiceUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "invoice_1", ...data }));
});

describe("POST /api/webhooks/razorpay/[firmId] — P0.5 payment → activity", () => {
  it("successful payment: updates the invoice to PAID and records INVOICE_PAID with SYSTEM actor", async () => {
    mockInvoiceFindFirst.mockResolvedValue({
      id: "invoice_1", firmId: FIRM_ID, status: "SENT", invoiceNumber: "INV/2026-27/0001", total: 25000,
      client: { name: "ABC Industries" },
    });

    const res = await POST(req(paidEvent()), { params: { firmId: FIRM_ID } });

    expect(res.status).toBe(200);
    expect(mockInvoiceUpdate).toHaveBeenCalledWith({
      where: { id: "invoice_1" },
      data: { status: "PAID", paidAt: expect.any(Date), paymentRef: "pay_1" },
    });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        firmId: FIRM_ID,
        entityType: "INVOICE",
        entityId: "invoice_1",
        eventType: "INVOICE_PAID",
        actorType: "SYSTEM",
        metadata: expect.objectContaining({ paymentId: "pay_1", amount: 25000 }),
      })
    );
  });

  it("never includes the webhook secret or any raw secret value in the recorded activity", async () => {
    mockInvoiceFindFirst.mockResolvedValue({
      id: "invoice_1", firmId: FIRM_ID, status: "SENT", invoiceNumber: "INV/2026-27/0001", total: 25000,
      client: { name: "ABC Industries" },
    });
    await POST(req(paidEvent()), { params: { firmId: FIRM_ID } });
    const [call] = mockRecordActivity.mock.calls;
    expect(JSON.stringify(call[0])).not.toContain("enc-secret");
  });

  it("duplicate webhook: an invoice already PAID is not updated again and records no second activity", async () => {
    mockInvoiceFindFirst.mockResolvedValue({
      id: "invoice_1", firmId: FIRM_ID, status: "PAID", invoiceNumber: "INV/2026-27/0001", total: 25000,
      client: { name: "ABC Industries" },
    });

    const res = await POST(req(paidEvent()), { params: { firmId: FIRM_ID } });

    expect(res.status).toBe(200);
    expect(mockInvoiceUpdate).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("unhandled/non-payment event: no invoice mutation and no activity recorded", async () => {
    const res = await POST(req({ event: "payment_link.expired", payload: {} }), { params: { firmId: FIRM_ID } });

    expect(res.status).toBe(200);
    expect(mockInvoiceFindFirst).not.toHaveBeenCalled();
    expect(mockInvoiceUpdate).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("wrong firm: a payment_link reference_id belonging to another firm resolves to no invoice, so nothing is recorded", async () => {
    // invoice.findFirst is itself firm-scoped ({ id, firmId: firm.id }) — a
    // cross-firm reference_id simply matches nothing, simulated here.
    mockInvoiceFindFirst.mockResolvedValue(null);

    const res = await POST(req(paidEvent({ invoiceId: "invoice_owned_by_other_firm" })), { params: { firmId: FIRM_ID } });

    expect(res.status).toBe(200);
    expect(mockInvoiceUpdate).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("invalid signature: request rejected before any invoice lookup, no activity recorded", async () => {
    mockVerifySignature.mockReturnValue(false);

    const res = await POST(req(paidEvent(), "bad-sig"), { params: { firmId: FIRM_ID } });

    expect(res.status).toBe(400);
    expect(mockInvoiceFindFirst).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("firm without Razorpay configured: rejected before any invoice lookup", async () => {
    mockFirmFindUnique.mockResolvedValue({ id: FIRM_ID, name: "Test Firm", razorpayWebhookSecretEnc: null });

    const res = await POST(req(paidEvent()), { params: { firmId: FIRM_ID } });

    expect(res.status).toBe(400);
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
