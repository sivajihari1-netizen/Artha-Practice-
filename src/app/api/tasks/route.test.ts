import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockTaskCreate = vi.fn();
const mockTaskFindMany = vi.fn();
const mockStatusOptionFindFirst = vi.fn();
const mockCategoryOptionFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      create: (...a: unknown[]) => mockTaskCreate(...a),
      findMany: (...a: unknown[]) => mockTaskFindMany(...a),
    },
    taskStatusOption: { findFirst: (...a: unknown[]) => mockStatusOptionFindFirst(...a) },
    taskCategoryOption: { findFirst: (...a: unknown[]) => mockCategoryOptionFindFirst(...a) },
  },
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { TASK_CREATED: "TASK_CREATED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "STAFF" as const, email: "staff@firm.test" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockStatusOptionFindFirst.mockResolvedValue(null);
  mockCategoryOptionFindFirst.mockResolvedValue(null);
  mockTaskCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "task_new", ...data }));
});

describe("POST /api/tasks — P1 batch: priority", () => {
  it("default behaviour: creating a task without priority leaves it unset (undefined, not a forced default)", async () => {
    const res = await POST(req({ title: "GSTR-3B — June" }));
    expect(res.status).toBe(201);
    const [{ data }] = mockTaskCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.priority).toBeUndefined();
  });

  it("creates a task with an explicit priority", async () => {
    const res = await POST(req({ title: "GSTR-3B — June", priority: "URGENT" }));
    expect(res.status).toBe(201);
    expect(mockTaskCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: "URGENT" }) }));
  });

  it("rejects an invalid priority value", async () => {
    const res = await POST(req({ title: "GSTR-3B — June", priority: "SUPER_URGENT" }));
    expect(res.status).toBe(400);
    expect(mockTaskCreate).not.toHaveBeenCalled();
  });

  it("existing task creation (no priority field at all) still works exactly as before — regression", async () => {
    const res = await POST(req({ title: "Plain task", clientId: "client_1", assigneeId: "user_2" }));
    expect(res.status).toBe(201);
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "TASK_CREATED" }));
  });
});
