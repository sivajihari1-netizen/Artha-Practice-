import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockTaskFindFirst = vi.fn();
const mockTaskUpdate = vi.fn();
const mockTaskDelete = vi.fn();
const mockStatusOptionFindFirst = vi.fn();
const mockStatusOptionFindUnique = vi.fn();
const mockCategoryOptionFindFirst = vi.fn();
const mockUserFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findFirst: (...args: unknown[]) => mockTaskFindFirst(...args),
      update: (...args: unknown[]) => mockTaskUpdate(...args),
      delete: (...args: unknown[]) => mockTaskDelete(...args),
    },
    taskStatusOption: {
      findFirst: (...args: unknown[]) => mockStatusOptionFindFirst(...args),
      findUnique: (...args: unknown[]) => mockStatusOptionFindUnique(...args),
    },
    taskCategoryOption: {
      findFirst: (...args: unknown[]) => mockCategoryOptionFindFirst(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
  },
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  // Mirrors src/lib/activity.ts's ActivityEvent map — kept as a literal here
  // rather than vi.importActual, which doesn't resolve the "@/" alias inside
  // a mock factory in this vitest setup.
  ActivityEvent: {
    TASK_CREATED: "TASK_CREATED",
    TASK_UPDATED: "TASK_UPDATED",
    TASK_ASSIGNED: "TASK_ASSIGNED",
    TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
    TASK_COMPLETED: "TASK_COMPLETED",
  },
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
}));

import { PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "STAFF" as const, email: "staff@firm.test" };
const TASK_ID = "task_1";

function req(body: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TASK_ID,
    firmId: SESSION.firmId,
    title: "GSTR-3B — June 2026",
    status: "TODO",
    returnType: "GST",
    statusOptionId: null,
    categoryOptionId: null,
    assigneeId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockStatusOptionFindFirst.mockResolvedValue(null);
  mockStatusOptionFindUnique.mockResolvedValue(null);
  mockCategoryOptionFindFirst.mockResolvedValue(null);
  mockUserFindFirst.mockResolvedValue({ id: "user_new", firmId: SESSION.firmId });
  mockTaskUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...baseTask(), ...data }));
});

describe("PATCH /api/tasks/[id] — activity recording", () => {
  it("records TASK_STATUS_CHANGED with the legacy status text when no custom workflow option is involved", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ status: "TODO" }));
    await PATCH(req({ status: "IN_PROGRESS" }), { params: { id: TASK_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_STATUS_CHANGED",
        title: "Status changed: TODO → IN_PROGRESS",
        metadata: { fromSystemKey: "TODO", toSystemKey: "IN_PROGRESS" },
      })
    );
  });

  it("uses the firm's configured workflow label in the title, not the raw system key", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ status: "TODO", statusOptionId: "opt_todo" }));
    mockStatusOptionFindUnique.mockResolvedValue({ name: "To Do" });
    mockStatusOptionFindFirst.mockResolvedValue({ id: "opt_review", systemKey: "REVIEW", name: "Partner Review" });
    await PATCH(req({ statusOptionId: "opt_review" }), { params: { id: TASK_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TASK_STATUS_CHANGED", title: "Status changed: To Do → Partner Review" })
    );
  });

  it("also fires TASK_COMPLETED when the new status resolves to DONE", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ status: "REVIEW" }));
    await PATCH(req({ status: "DONE" }), { params: { id: TASK_ID } });
    const eventTypes = mockRecordActivity.mock.calls.map((call) => (call[0] as { eventType: string }).eventType);
    expect(eventTypes).toEqual(expect.arrayContaining(["TASK_STATUS_CHANGED", "TASK_COMPLETED"]));
  });

  it("does not fire TASK_COMPLETED when status changes but doesn't resolve to DONE", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ status: "TODO" }));
    await PATCH(req({ status: "IN_PROGRESS" }), { params: { id: TASK_ID } });
    const eventTypes = mockRecordActivity.mock.calls.map((call) => (call[0] as { eventType: string }).eventType);
    expect(eventTypes).not.toContain("TASK_COMPLETED");
  });

  it("records TASK_ASSIGNED with previous/new assignee metadata, for an authorized (non-Staff) reassignment", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "MANAGER" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_old" }));
    await PATCH(req({ assigneeId: "user_new" }), { params: { id: TASK_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_ASSIGNED",
        metadata: { previousAssigneeId: "user_old", newAssigneeId: "user_new" },
      })
    );
  });

  it("records TASK_UPDATED for title/description/dueDate changes only", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    await PATCH(req({ title: "Renamed task" }), { params: { id: TASK_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TASK_UPDATED", metadata: { changedFields: ["title"] } })
    );
  });

  it("records no activity at all for a no-op PATCH (nothing actually changed)", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ status: "TODO" }));
    await PATCH(req({}), { params: { id: TASK_ID } });
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("does not record an assignment activity when assigneeId is sent but unchanged", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_same" }));
    await PATCH(req({ assigneeId: "user_same" }), { params: { id: TASK_ID } });
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/tasks/[id] — P1 batch: reassignment security (spec E/F)", () => {
  it("(E) rejects reassignment attempted by a Staff-role session — 403, no update, no activity", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_old" }));
    const res = await PATCH(req({ assigneeId: "user_new" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(403);
    expect(mockTaskUpdate).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("a Staff-role session can still update other fields (status, title) — the 403 is scoped to reassignment only", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ status: "TODO" }));
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(200);
  });

  it("a Staff-role session PATCHing the assignee's current (unchanged) value is not rejected — no genuine reassignment occurred", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_same" }));
    const res = await PATCH(req({ assigneeId: "user_same" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(200);
  });

  it("(F) rejects an assigneeId that doesn't resolve to a user in this firm, even for an authorized Manager", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "MANAGER" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_old" }));
    mockUserFindFirst.mockResolvedValue(null); // firm-scoped lookup finds nothing for a cross-firm id
    const res = await PATCH(req({ assigneeId: "user_owned_by_other_firm" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(400);
    expect(mockTaskUpdate).not.toHaveBeenCalled();
    expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { id: "user_owned_by_other_firm", firmId: "firm_1" } });
  });

  it("Partner can reassign successfully", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "PARTNER" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_old" }));
    const res = await PATCH(req({ assigneeId: "user_new" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(200);
  });

  it("unassigning (assigneeId: null) does not require a user lookup and is allowed for Manager", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "MANAGER" } });
    mockTaskFindFirst.mockResolvedValue(baseTask({ assigneeId: "user_old" }));
    const res = await PATCH(req({ assigneeId: null }), { params: { id: TASK_ID } });
    expect(res.status).toBe(200);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/tasks/[id] — P1 batch: priority (spec G)", () => {
  it("(G) a priority update goes through the same firm-scoped authorization as any other field — Staff can set it (not a reassignment)", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    mockTaskFindFirst.mockResolvedValue(baseTask());
    const res = await PATCH(req({ priority: "URGENT" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(200);
    expect(mockTaskUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: "URGENT" }) }));
  });

  it("records the change via the existing generic TASK_UPDATED field-tracking mechanism — no new activity event invented", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    await PATCH(req({ priority: "HIGH" }), { params: { id: TASK_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TASK_UPDATED", metadata: { changedFields: ["priority"] } })
    );
  });

  it("clearing priority (null) is accepted", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask({ priority: "LOW" }));
    const res = await PATCH(req({ priority: null }), { params: { id: TASK_ID } });
    expect(res.status).toBe(200);
  });

  it("(cross-firm) a task belonging to another firm is rejected before any field is touched — unchanged firm-scoping behavior", async () => {
    mockTaskFindFirst.mockResolvedValue(null); // firm-scoped findFirst finds nothing for another firm's task
    const res = await PATCH(req({ priority: "URGENT" }), { params: { id: TASK_ID } });
    expect(res.status).toBe(404);
    expect(mockTaskUpdate).not.toHaveBeenCalled();
  });
});
