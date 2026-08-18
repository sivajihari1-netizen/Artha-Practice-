import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({ requireSession: () => mockRequireSession() }));

const mockQuotationFindFirst = vi.fn();
const mockQuotationUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quotation: {
      findFirst: (...a: unknown[]) => mockQuotationFindFirst(...a),
      update: (...a: unknown[]) => mockQuotationUpdate(...a),
    },
  },
}));

vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { QUOTATION_SENT: "QUOTATION_SENT", QUOTATION_ACCEPTED: "QUOTATION_ACCEPTED", QUOTATION_DECLINED: "QUOTATION_DECLINED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "MANAGER" as const, email: "m@firm.test" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/quotations/quo_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockQuotationFindFirst.mockResolvedValue({ id: "quo_1", firmId: "firm_1", status: "DRAFT", quotationNumber: "QUO/2026-27/0001" });
  mockQuotationUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "quo_1", ...data }));
});

describe("PATCH /api/quotations/[id] — R: untouched by the Quotation -> Invoice batch", () => {
  it("still records QUOTATION_SENT when status moves DRAFT -> SENT", async () => {
    const res = await PATCH(req({ status: "SENT" }), { params: { id: "quo_1" } });
    expect(res.status).toBe(200);
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "QUOTATION_SENT" }));
  });

  it("still lets staff edit fee items and other content fields directly", async () => {
    const feeItems = [{ particulars: "GST filing", fee: 6000, frequency: "Monthly" }];
    await PATCH(req({ feeItems }), { params: { id: "quo_1" } });
    expect(mockQuotationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ feeItems }) }));
  });
});
