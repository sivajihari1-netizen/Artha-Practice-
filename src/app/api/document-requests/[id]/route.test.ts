import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockDocumentRequestFindFirst = vi.fn();
const mockDocumentRequestUpdate = vi.fn();
const mockTaskFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentRequest: {
      findFirst: (...a: unknown[]) => mockDocumentRequestFindFirst(...a),
      update: (...a: unknown[]) => mockDocumentRequestUpdate(...a),
    },
    task: { findFirst: (...a: unknown[]) => mockTaskFindFirst(...a) },
  },
}));

import { PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "partner@firm.test" };
const CLIENT_A = "client_a";
const CLIENT_B = "client_b";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/document-requests/req_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockDocumentRequestUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "req_1", ...data }));
});

describe("PATCH /api/document-requests/[id] — P1 batch: link/unlink Task", () => {
  it("(A) links to a same-firm, same-client task — allowed", async () => {
    mockDocumentRequestFindFirst.mockResolvedValue({ id: "req_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_A });
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "req_1" } });
    expect(res.status).toBe(200);
    expect(mockDocumentRequestUpdate).toHaveBeenCalledWith({ where: { id: "req_1" }, data: { taskId: "task_1" } });
  });

  it("(D) explicit null unlinks successfully, no task lookup performed", async () => {
    mockDocumentRequestFindFirst.mockResolvedValue({ id: "req_1", firmId: "firm_1", clientId: CLIENT_A, taskId: "task_1" });
    const res = await PATCH(req({ taskId: null }), { params: { id: "req_1" } });
    expect(res.status).toBe(200);
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
    expect(mockDocumentRequestUpdate).toHaveBeenCalledWith({ where: { id: "req_1" }, data: { taskId: null } });
  });

  it("(B) cross-firm task is rejected", async () => {
    mockDocumentRequestFindFirst.mockResolvedValue({ id: "req_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue(null);
    const res = await PATCH(req({ taskId: "task_other_firm" }), { params: { id: "req_1" } });
    expect(res.status).toBe(400);
    expect(mockDocumentRequestUpdate).not.toHaveBeenCalled();
  });

  it("(C) a same-firm task belonging to a different client is rejected", async () => {
    mockDocumentRequestFindFirst.mockResolvedValue({ id: "req_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_B });
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "req_1" } });
    expect(res.status).toBe(400);
    expect(mockDocumentRequestUpdate).not.toHaveBeenCalled();
  });

  it("cross-firm document request access is rejected before any task validation runs", async () => {
    mockDocumentRequestFindFirst.mockResolvedValue(null); // firm-scoped findFirst finds nothing for another firm's request
    const res = await PATCH(req({ taskId: "task_1" }), { params: { id: "req_1" } });
    expect(res.status).toBe(404);
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
  });

  it("task deletion leaves the DocumentRequest intact (ON DELETE SET NULL, not a cascade) — simulated by a request whose taskId is already null after the FK fired", async () => {
    // This is a DB-level guarantee (verified in the migration SQL), not
    // application logic — this test documents the expected read-side shape:
    // the request row still exists and is fully functional with taskId: null.
    mockDocumentRequestFindFirst.mockResolvedValue({ id: "req_1", firmId: "firm_1", clientId: CLIENT_A, taskId: null });
    const res = await PATCH(req({ note: undefined }), { params: { id: "req_1" } });
    expect(res.status).toBe(200);
  });
});
