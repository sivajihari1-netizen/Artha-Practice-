import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

vi.mock("@/lib/recurringTasks", () => ({
  generateComplianceRuleTasks: vi.fn().mockResolvedValue(undefined),
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { CLIENT_CREATED: "CLIENT_CREATED" },
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "partner@firm.test" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "client_1", ...data }));
});

describe("POST /api/clients — activity recording", () => {
  it("records CLIENT_CREATED with the resolved entity type in metadata", async () => {
    const res = await POST(req({ name: "Srinivasulu and Co", type: "PARTNERSHIP" }));
    expect(res.status).toBe(201);
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "CLIENT",
        entityId: "client_1",
        eventType: "CLIENT_CREATED",
        actorId: "user_1",
        metadata: { type: "PARTNERSHIP" },
      })
    );
  });

  it("does not record activity when the request is invalid", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
