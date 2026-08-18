import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockTemplateFindFirst = vi.fn();
const mockTemplateUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskTemplate: {
      findFirst: (...a: unknown[]) => mockTemplateFindFirst(...a),
      update: (...a: unknown[]) => mockTemplateUpdate(...a),
    },
  },
}));

import { PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };
const TEMPLATE_ID = "tmpl_1";
const EXISTING_TEMPLATE = { id: TEMPLATE_ID, firmId: "firm_1", title: "GSTR-3B", returnType: "GST", recurrence: "MONTHLY", checklist: null, active: true };

function patchReq(body: unknown) {
  return new NextRequest(`http://localhost/api/task-templates/${TEMPLATE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockTemplateFindFirst.mockResolvedValue(EXISTING_TEMPLATE);
  mockTemplateUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...EXISTING_TEMPLATE, ...data }));
});

describe("PATCH /api/task-templates/[id] — Batch D: edit", () => {
  it("edits title/returnType/recurrence for a same-firm template", async () => {
    const res = await PATCH(patchReq({ title: "GSTR-3B (revised)", returnType: "GST", recurrence: "QUARTERLY" }), { params: { id: TEMPLATE_ID } });
    expect(res.status).toBe(200);
    expect(mockTemplateUpdate).toHaveBeenCalledWith({
      where: { id: TEMPLATE_ID },
      data: { title: "GSTR-3B (revised)", returnType: "GST", recurrence: "QUARTERLY" },
    });
  });

  it("rejects an invalid recurrence value", async () => {
    const res = await PATCH(patchReq({ recurrence: "DAILY" }), { params: { id: TEMPLATE_ID } });
    expect(res.status).toBe(400);
    expect(mockTemplateUpdate).not.toHaveBeenCalled();
  });

  it("a cross-firm template 404s and is never touched", async () => {
    mockTemplateFindFirst.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "x" }), { params: { id: "other_firms_template" } });
    expect(res.status).toBe(404);
    expect(mockTemplateUpdate).not.toHaveBeenCalled();
    // The lookup itself is firm-scoped, not just the eventual write.
    expect(mockTemplateFindFirst).toHaveBeenCalledWith({ where: { id: "other_firms_template", firmId: "firm_1" } });
  });

  it("a STAFF caller is rejected with 403 before any query runs", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await PATCH(patchReq({ title: "x" }), { params: { id: TEMPLATE_ID } });
    expect(res.status).toBe(403);
    expect(mockTemplateFindFirst).not.toHaveBeenCalled();
    expect(mockTemplateUpdate).not.toHaveBeenCalled();
  });

  it("a MANAGER caller is allowed (only STAFF is blocked, matching the existing POST gate)", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "MANAGER" } });
    const res = await PATCH(patchReq({ title: "x" }), { params: { id: TEMPLATE_ID } });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/task-templates/[id] — Batch D: deactivate/reactivate", () => {
  it("deactivates an active template by setting active:false", async () => {
    const res = await PATCH(patchReq({ active: false }), { params: { id: TEMPLATE_ID } });
    expect(res.status).toBe(200);
    expect(mockTemplateUpdate).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID }, data: { active: false } });
    const data = await res.json();
    expect(data.template.active).toBe(false);
  });

  it("reactivates an inactive template by setting active:true", async () => {
    mockTemplateFindFirst.mockResolvedValue({ ...EXISTING_TEMPLATE, active: false });
    const res = await PATCH(patchReq({ active: true }), { params: { id: TEMPLATE_ID } });
    expect(res.status).toBe(200);
    expect(mockTemplateUpdate).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID }, data: { active: true } });
  });

  it("deactivating a template only ever touches the template row — no Task rows are read or written by this route", async () => {
    await PATCH(patchReq({ active: false }), { params: { id: TEMPLATE_ID } });
    // Nothing beyond taskTemplate.findFirst/update was mocked or called — if
    // this route ever reached into prisma.task, the mock module has no such
    // method and the call would throw, failing this test.
    expect(mockTemplateUpdate).toHaveBeenCalledTimes(1);
  });
});
