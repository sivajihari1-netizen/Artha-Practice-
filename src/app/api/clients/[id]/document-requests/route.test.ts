import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockClientFindFirst = vi.fn();
const mockTaskFindFirst = vi.fn();
const mockDocumentRequestCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: (...a: unknown[]) => mockClientFindFirst(...a) },
    task: { findFirst: (...a: unknown[]) => mockTaskFindFirst(...a) },
    documentRequest: { create: (...a: unknown[]) => mockDocumentRequestCreate(...a) },
  },
}));

const mockSendWhatsAppMessage = vi.fn();
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: (...a: unknown[]) => mockSendWhatsAppMessage(...a),
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "partner@firm.test" };
const CLIENT_A = "client_a";
const CLIENT_B = "client_b";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/clients/client_a/document-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function client(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: CLIENT_A, firmId: SESSION.firmId, name: "Acme", contacts: [{ phone: "+919876543210" }], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockClientFindFirst.mockResolvedValue(client());
  mockSendWhatsAppMessage.mockResolvedValue({ ok: true });
  mockDocumentRequestCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "req_1", items: [], ...data }));
});

describe("POST /api/clients/[id]/document-requests — P1 batch: optional Task link", () => {
  it("creates a request with no taskId when none is provided — existing behaviour unchanged", async () => {
    const res = await POST(req({ items: ["Bank statement"] }), { params: { id: CLIENT_A } });
    expect(res.status).toBe(201);
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
    expect(mockDocumentRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taskId: undefined }) })
    );
  });

  it("(A) links to a task in the same firm and same client — allowed", async () => {
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_A });
    const res = await POST(req({ items: ["Bank statement"], taskId: "task_1" }), { params: { id: CLIENT_A } });
    expect(res.status).toBe(201);
    expect(mockTaskFindFirst).toHaveBeenCalledWith({ where: { id: "task_1", firmId: "firm_1" } });
    expect(mockDocumentRequestCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ taskId: "task_1" }) }));
  });

  it("(B) cross-firm task is rejected — the firm-scoped lookup resolves to nothing", async () => {
    mockTaskFindFirst.mockResolvedValue(null);
    const res = await POST(req({ items: ["Bank statement"], taskId: "task_other_firm" }), { params: { id: CLIENT_A } });
    expect(res.status).toBe(400);
    expect(mockDocumentRequestCreate).not.toHaveBeenCalled();
  });

  it("(C) a same-firm task belonging to a different client is rejected", async () => {
    mockTaskFindFirst.mockResolvedValue({ id: "task_1", firmId: "firm_1", clientId: CLIENT_B });
    const res = await POST(req({ items: ["Bank statement"], taskId: "task_1" }), { params: { id: CLIENT_A } });
    expect(res.status).toBe(400);
    expect(mockDocumentRequestCreate).not.toHaveBeenCalled();
  });
});
