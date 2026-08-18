import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { LEAD_CREATED: "LEAD_CREATED" },
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "STAFF" as const, email: "staff@firm.test" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "lead_1", ...data }));
});

describe("POST /api/leads — notes on create", () => {
  it("creates a lead with notes", async () => {
    const res = await POST(req({ name: "ABC Industries", notes: "Met CFO on Tuesday. Budget approved." }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: "Met CFO on Tuesday. Budget approved." }) })
    );
  });

  it("creates a lead without notes (still optional)", async () => {
    const res = await POST(req({ name: "XYZ Traders" }));
    expect(res.status).toBe(201);
    const [{ data }] = mockCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.notes).toBeUndefined();
    expect(data.name).toBe("XYZ Traders");
  });

  it("always uses the session's firmId, ignoring any firmId in the request body", async () => {
    await POST(req({ name: "Sneaky Co", firmId: "someone_elses_firm" }));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firmId: "firm_1" }) }));
  });

  it("records LEAD_CREATED", async () => {
    await POST(req({ name: "ABC Industries" }));
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAD_CREATED", entityType: "LEAD", entityId: "lead_1" })
    );
  });
});
