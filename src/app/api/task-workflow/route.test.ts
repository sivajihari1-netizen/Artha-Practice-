import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockStatusFindMany = vi.fn();
const mockCategoryFindMany = vi.fn();
const mockStatusCreate = vi.fn();
const mockCategoryCreate = vi.fn();
const mockStatusUpdate = vi.fn();
const mockCategoryUpdate = vi.fn();
const mockStatusFindFirst = vi.fn();
const mockCategoryFindFirst = vi.fn();
const mockStatusDelete = vi.fn();
const mockCategoryDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskStatusOption: {
      findMany: (...a: unknown[]) => mockStatusFindMany(...a),
      create: (...a: unknown[]) => mockStatusCreate(...a),
      update: (...a: unknown[]) => mockStatusUpdate(...a),
      findFirst: (...a: unknown[]) => mockStatusFindFirst(...a),
      delete: (...a: unknown[]) => mockStatusDelete(...a),
    },
    taskCategoryOption: {
      findMany: (...a: unknown[]) => mockCategoryFindMany(...a),
      create: (...a: unknown[]) => mockCategoryCreate(...a),
      update: (...a: unknown[]) => mockCategoryUpdate(...a),
      findFirst: (...a: unknown[]) => mockCategoryFindFirst(...a),
      delete: (...a: unknown[]) => mockCategoryDelete(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

import { DELETE, PUT } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };

function putReq(body: unknown) {
  return new NextRequest("http://localhost/api/task-workflow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(type: string, id: string) {
  return new NextRequest(`http://localhost/api/task-workflow?type=${type}&id=${id}`, { method: "DELETE" });
}

// The real handler runs inside prisma.$transaction(async (tx) => {...}); the
// mock just invokes the callback with a `tx` object backed by the same
// mocked collection methods, so the transaction body's logic actually runs.
function tx() {
  return {
    taskStatusOption: { findMany: mockStatusFindMany, create: mockStatusCreate, update: mockStatusUpdate },
    taskCategoryOption: { findMany: mockCategoryFindMany, create: mockCategoryCreate, update: mockCategoryUpdate },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockStatusFindMany.mockResolvedValue([]);
  mockCategoryFindMany.mockResolvedValue([]);
  mockStatusCreate.mockResolvedValue({ id: "new_status_1" });
  mockCategoryCreate.mockResolvedValue({ id: "new_category_1" });
  mockStatusUpdate.mockResolvedValue({});
  mockCategoryUpdate.mockResolvedValue({});
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx()));
});

describe("PUT /api/task-workflow — existing edit behavior (unchanged)", () => {
  it("updates an existing, firm-owned status option", async () => {
    mockStatusFindMany.mockResolvedValue([{ id: "status_1" }]);
    const res = await PUT(putReq({ statuses: [{ id: "status_1", name: "Doing", key: "IN_PROGRESS", isActive: true, isDefault: true }] }));
    expect(res.status).toBe(200);
    expect(mockStatusUpdate).toHaveBeenCalledWith({
      where: { id: "status_1" },
      data: { name: "Doing", key: "IN_PROGRESS", description: null, sortOrder: 0, color: null, isActive: true, isDefault: true },
    });
    expect(mockStatusCreate).not.toHaveBeenCalled();
  });

  it("deactivating an existing option (isActive:false) already works via this same path", async () => {
    mockStatusFindMany.mockResolvedValue([{ id: "status_1" }]);
    await PUT(putReq({ statuses: [{ id: "status_1", name: "Doing", key: "IN_PROGRESS", isActive: false, isDefault: false }] }));
    expect(mockStatusUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
  });

  it("rejects an id that doesn't belong to this firm", async () => {
    mockStatusFindMany.mockResolvedValue([]); // firm owns nothing
    const res = await PUT(putReq({ statuses: [{ id: "someone_elses_status", name: "X", key: "X" }] }));
    expect(res.status).toBe(400);
    expect(mockStatusUpdate).not.toHaveBeenCalled();
  });

  it("a STAFF caller is rejected with 403 before any query runs", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await PUT(putReq({ statuses: [] }));
    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("PUT /api/task-workflow — Batch D: create (the id-less rows that used to be silently skipped)", () => {
  it("a status row with no id is created, scoped to the caller's firm, forced isDefault:false", async () => {
    const res = await PUT(putReq({ statuses: [{ name: "Blocked", key: "BLOCKED", color: "#f00", isActive: true, isDefault: true }] }));
    expect(res.status).toBe(200);
    expect(mockStatusCreate).toHaveBeenCalledWith({
      data: { firmId: "firm_1", name: "Blocked", key: "BLOCKED", description: null, sortOrder: 0, color: "#f00", isActive: true, isDefault: false },
    });
  });

  it("a category row with no id is created the same way", async () => {
    const res = await PUT(putReq({ categories: [{ name: "Payroll", key: "PAYROLL" }] }));
    expect(res.status).toBe(200);
    expect(mockCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firmId: "firm_1", name: "Payroll", key: "PAYROLL", isDefault: false }) })
    );
  });

  it("rejects an empty name/key even for a create", async () => {
    const res = await PUT(putReq({ statuses: [{ name: "", key: "" }] }));
    expect(res.status).toBe(400);
    expect(mockStatusCreate).not.toHaveBeenCalled();
  });

  it("a duplicate key within the firm surfaces as a clean 400, not a raw 500", async () => {
    mockStatusCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`firmId`,`key`)", { code: "P2002", clientVersion: "5.22.0" })
    );
    const res = await PUT(putReq({ statuses: [{ name: "To Do", key: "TODO" }] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already exists/i);
  });

  it("a STAFF caller cannot create either, same 403 gate as edit", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await PUT(putReq({ statuses: [{ name: "Blocked", key: "BLOCKED" }] }));
    expect(res.status).toBe(403);
    expect(mockStatusCreate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/task-workflow — Batch D: delete", () => {
  it("deletes a firm-owned, non-default, unused status option", async () => {
    mockStatusFindFirst.mockResolvedValue({ id: "status_1", firmId: "firm_1", isDefault: false, _count: { tasks: 0 } });
    const res = await DELETE(deleteReq("status", "status_1"));
    expect(res.status).toBe(200);
    expect(mockStatusDelete).toHaveBeenCalledWith({ where: { id: "status_1" } });
  });

  it("deletes a firm-owned, non-default, unused category option", async () => {
    mockCategoryFindFirst.mockResolvedValue({ id: "cat_1", firmId: "firm_1", isDefault: false, _count: { tasks: 0 } });
    const res = await DELETE(deleteReq("category", "cat_1"));
    expect(res.status).toBe(200);
    expect(mockCategoryDelete).toHaveBeenCalledWith({ where: { id: "cat_1" } });
  });

  it("refuses to delete a default system status, telling the caller to deactivate instead", async () => {
    mockStatusFindFirst.mockResolvedValue({ id: "status_1", firmId: "firm_1", isDefault: true, _count: { tasks: 0 } });
    const res = await DELETE(deleteReq("status", "status_1"));
    expect(res.status).toBe(400);
    expect(mockStatusDelete).not.toHaveBeenCalled();
  });

  it("refuses to delete a status option that's still referenced by existing tasks — never orphans a Task", async () => {
    mockStatusFindFirst.mockResolvedValue({ id: "status_1", firmId: "firm_1", isDefault: false, _count: { tasks: 3 } });
    const res = await DELETE(deleteReq("status", "status_1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/3 task/);
    expect(mockStatusDelete).not.toHaveBeenCalled();
  });

  it("a cross-firm option 404s and is never touched", async () => {
    mockStatusFindFirst.mockResolvedValue(null);
    const res = await DELETE(deleteReq("status", "other_firms_status"));
    expect(res.status).toBe(404);
    expect(mockStatusDelete).not.toHaveBeenCalled();
    expect(mockStatusFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "other_firms_status", firmId: "firm_1" } }));
  });

  it("a STAFF caller is rejected with 403 before any lookup runs", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await DELETE(deleteReq("status", "status_1"));
    expect(res.status).toBe(403);
    expect(mockStatusFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a missing/invalid type param", async () => {
    const res = await DELETE(new NextRequest("http://localhost/api/task-workflow?id=status_1", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });
});
