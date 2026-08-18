import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockClientFindFirst = vi.fn();
const mockClientUpdate = vi.fn();
const mockClientGstinFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findFirst: (...a: unknown[]) => mockClientFindFirst(...a),
      update: (...a: unknown[]) => mockClientUpdate(...a),
    },
    clientGstin: { findMany: (...a: unknown[]) => mockClientGstinFindMany(...a) },
  },
}));

vi.mock("@/lib/recurringTasks", () => ({ generateComplianceRuleTasks: vi.fn().mockResolvedValue(undefined) }));

const mockLogAudit = vi.fn();
vi.mock("@/lib/auditLog", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { CLIENT_UPDATED: "CLIENT_UPDATED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { DELETE, GET, PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "STAFF" as const, email: "s@firm.test" };
const CLIENT_ID = "client_1";
const EXISTING_CLIENT = { id: CLIENT_ID, firmId: "firm_1", name: "Acme Pvt Ltd", active: true };

function patchReq(body: unknown) {
  return new NextRequest(`http://localhost/api/clients/${CLIENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockClientFindFirst.mockResolvedValue(EXISTING_CLIENT);
  mockClientUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...EXISTING_CLIENT, ...data }));
  mockClientGstinFindMany.mockResolvedValue([]);
});

describe("DELETE /api/clients/[id] — Batch C: archive (soft delete), reused verbatim", () => {
  it("archives the client by setting active:false, never a hard delete", async () => {
    const res = await DELETE(new NextRequest(`http://localhost/api/clients/${CLIENT_ID}`, { method: "DELETE" }), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(200);
    expect(mockClientUpdate).toHaveBeenCalledWith({ where: { id: CLIENT_ID }, data: { active: false } });
  });

  it("records both logAudit (client.delete) and CLIENT_UPDATED activity, titled as an archive", async () => {
    await DELETE(new NextRequest(`http://localhost/api/clients/${CLIENT_ID}`, { method: "DELETE" }), { params: { id: CLIENT_ID } });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "client.delete" }));
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CLIENT_UPDATED", title: expect.stringContaining("archived") })
    );
  });

  it("a cross-firm client 404s and is never touched", async () => {
    mockClientFindFirst.mockResolvedValue(null);
    const res = await DELETE(new NextRequest(`http://localhost/api/clients/other_firms_client`, { method: "DELETE" }), {
      params: { id: "other_firms_client" },
    });
    expect(res.status).toBe(404);
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("is reachable by any authenticated role today, including STAFF — confirms the existing (unchanged) backend has no role gate here", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await DELETE(new NextRequest(`http://localhost/api/clients/${CLIENT_ID}`, { method: "DELETE" }), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/clients/[id] — Batch C: reactivate via the existing generic update", () => {
  it("reactivates an archived client by setting active:true", async () => {
    mockClientFindFirst.mockResolvedValue({ ...EXISTING_CLIENT, active: false });
    const res = await PATCH(patchReq({ active: true }), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.client.active).toBe(true);
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CLIENT_UPDATED" }));
  });

  it("a cross-firm client 404s on reactivation attempts too", async () => {
    mockClientFindFirst.mockResolvedValue(null);
    const res = await PATCH(patchReq({ active: true }), { params: { id: "other_firms_client" } });
    expect(res.status).toBe(404);
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("existing field edits (e.g. turnover) remain unaffected by the archive addition", async () => {
    const res = await PATCH(patchReq({ turnover: 5000000 }), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(200);
    expect(mockClientUpdate).toHaveBeenCalledWith({ where: { id: CLIENT_ID }, data: { turnover: 5000000 } });
  });
});

describe("GET /api/clients/[id] — Batch C: unaffected, still returns an archived client's full record", () => {
  it("returns the client regardless of active state — no filtering added", async () => {
    mockClientFindFirst.mockResolvedValue({ ...EXISTING_CLIENT, active: false, contacts: [], credentials: [], dscRecords: [], tasks: [] });
    const res = await GET(new NextRequest(`http://localhost/api/clients/${CLIENT_ID}`), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.client.active).toBe(false);
  });
});
