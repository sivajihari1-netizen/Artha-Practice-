import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuotationFindUnique = vi.fn();
const mockQuotationUpdate = vi.fn();
const mockUserFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quotation: {
      findUnique: (...a: unknown[]) => mockQuotationFindUnique(...a),
      update: (...a: unknown[]) => mockQuotationUpdate(...a),
    },
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    // Deliberately no `invoice` key at all — if this route ever touched
    // prisma.invoice.* (auto-creating an invoice on acceptance), calling it
    // against this mock would throw "Cannot read properties of undefined",
    // failing the test below. This is the structural guarantee, not just an
    // assertion.
  },
}));

vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { QUOTATION_ACCEPTED: "QUOTATION_ACCEPTED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/public/quotations/tok_1/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindMany.mockResolvedValue([]);
  mockQuotationUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "quo_1", ...data }));
});

describe("POST /api/public/quotations/[token]/accept — M: unchanged by the Quotation -> Invoice batch", () => {
  it("still only sets status/acceptedAt/acceptedByName/acceptedIp — never touches an invoice", async () => {
    mockQuotationFindUnique.mockResolvedValue({
      id: "quo_1",
      firmId: "firm_1",
      status: "SENT",
      quotationNumber: "QUO/2026-27/0001",
      title: "GST Registration",
      client: { name: "Acme" },
      firm: { id: "firm_1", name: "Test Firm" },
    });

    const res = await POST(req({ name: "Ramesh" }), { params: { token: "tok_1" } });
    expect(res.status).toBe(200);
    expect(mockQuotationUpdate).toHaveBeenCalledWith({
      where: { id: "quo_1" },
      data: expect.objectContaining({ status: "ACCEPTED", acceptedByName: "Ramesh" }),
    });
    // No invoice was ever created as a side effect of acceptance.
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "QUOTATION_ACCEPTED" }));
    expect(mockRecordActivity).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: "INVOICE_CREATED" }));
  });

  it("still rejects re-accepting an already-accepted quotation", async () => {
    mockQuotationFindUnique.mockResolvedValue({ id: "quo_1", firmId: "firm_1", status: "ACCEPTED" });
    const res = await POST(req({ name: "Ramesh" }), { params: { token: "tok_1" } });
    expect(res.status).toBe(409);
    expect(mockQuotationUpdate).not.toHaveBeenCalled();
  });
});
