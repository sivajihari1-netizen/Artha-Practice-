import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockDocumentFindFirst = vi.fn();
const mockDocumentUpdate = vi.fn();
const mockTaskFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: (...a: unknown[]) => mockDocumentFindFirst(...a),
      update: (...a: unknown[]) => mockDocumentUpdate(...a),
    },
    task: {
      findFirst: (...a: unknown[]) => mockTaskFindFirst(...a),
    },
  },
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/auditLog", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { DOCUMENT_DELETED: "DOCUMENT_DELETED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { PATCH, DELETE } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "partner@firm.test" };
const CLIENT_A = "client_a";
const CLIENT_B = "client_b";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/documents/doc_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockDocumentUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "doc_1", ...data }));
});

describe("PATCH /api/documents/[id] — Task <-> Document linking", () => {
  it("(6) a document can be reclassified without ever touching taskId — existing behavior unchanged", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    const res = await PATCH(req({ category: "Bank Statement" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
    expect(mockDocumentUpdate).toHaveBeenCalledWith({ where: { id: "doc_1" }, data: { category: "Bank Statement" } });
  });

  it("(7)+(A) a document can link to a task in the same firm and same client — allowed", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_A });
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
    expect(mockTaskFindFirst).toHaveBeenCalledWith({ where: { id: "task_1", firmId: "firm_1" } });
    expect(mockDocumentUpdate).toHaveBeenCalledWith({ where: { id: "doc_1" }, data: { taskId: "task_1" } });
  });

  it("(8) the response reflects the correct linked taskId", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_A });
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "doc_1" } });
    const { document } = await res.json();
    expect(document.taskId).toBe("task_1");
  });

  it("(9)+(C) a taskId belonging to another firm is rejected — findFirst is itself firm-scoped, so it resolves to nothing", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue(null); // simulates the firm-scoped query finding no row for a cross-firm task id
    const res = await PATCH(req({ taskId: "task_owned_by_other_firm" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(400);
    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it("rejects linking to a same-firm task that belongs to a different client — client-safe, not just firm-safe", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_B });
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(400);
    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it("(B) a document with no clientId (unassigned) can still link to any same-firm task — no client to conflict with", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: null, taskId: null });
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_A });
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
  });

  it("(D) explicitly setting taskId to null unlinks — existing (unlinked) behavior is reachable, not just the initial default", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: "task_1" });
    const res = await PATCH(req({ taskId: null }), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
    expect(mockTaskFindFirst).not.toHaveBeenCalled(); // null never needs a lookup
    expect(mockDocumentUpdate).toHaveBeenCalledWith({ where: { id: "doc_1" }, data: { taskId: null } });
  });

  it("(E) cross-firm document access is rejected before any task validation runs", async () => {
    mockDocumentFindFirst.mockResolvedValue(null); // firm-scoped findFirst finds nothing for another firm's document
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(404);
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/documents/[id] — (F) existing document workflows unchanged by this feature", () => {
  it("still soft-deletes correctly, unaffected by the taskId addition", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: "firm_1", clientId: CLIENT_A, taskId: "task_1", fileName: "a.pdf" });
    mockDocumentUpdate.mockResolvedValue({ id: "doc_1", clientId: CLIENT_A, fileName: "a.pdf", status: "DELETED" });
    const res = await DELETE(new NextRequest("http://localhost/api/documents/doc_1", { method: "DELETE" }), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "DOCUMENT_DELETED" }));
  });
});
