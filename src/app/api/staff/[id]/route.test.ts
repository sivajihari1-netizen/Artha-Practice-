import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockUserFindFirst = vi.fn();
const mockUserUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/auditLog", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { STAFF_UPDATED: "STAFF_UPDATED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { PATCH } from "./route";

const PARTNER_SESSION = { userId: "user_partner", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };
const EXISTING_STAFF = { id: "user_staff1", firmId: "firm_1", name: "Priya Sharma", role: "STAFF" as const, active: true };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/staff/user_staff1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: PARTNER_SESSION });
  mockUserFindFirst.mockResolvedValue(EXISTING_STAFF);
  mockUserUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: "user_staff1",
    name: "Priya Sharma",
    email: "priya@firm.test",
    role: EXISTING_STAFF.role,
    active: EXISTING_STAFF.active,
    ...data,
  }));
});

describe("PATCH /api/staff/[id] — Batch A: Staff role & account management", () => {
  it("1. a Partner can change a staff member's role", async () => {
    const res = await PATCH(req({ role: "MANAGER" }), { params: { id: "user_staff1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.role).toBe("MANAGER");
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user_staff1" }, data: { role: "MANAGER" } }));
  });

  it("2. a Partner can deactivate a staff member", async () => {
    const res = await PATCH(req({ active: false }), { params: { id: "user_staff1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.active).toBe(false);
  });

  it("3. a Partner can reactivate a staff member", async () => {
    mockUserFindFirst.mockResolvedValue({ ...EXISTING_STAFF, active: false });
    const res = await PATCH(req({ active: true }), { params: { id: "user_staff1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.active).toBe(true);
  });

  it("4. a Manager cannot change role or status — 403, nothing updated", async () => {
    mockRequireSession.mockReturnValue({ session: { ...PARTNER_SESSION, role: "MANAGER" } });
    const res = await PATCH(req({ role: "PARTNER" }), { params: { id: "user_staff1" } });
    expect(res.status).toBe(403);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("5. Staff cannot change role or status — 403, nothing updated", async () => {
    mockRequireSession.mockReturnValue({ session: { ...PARTNER_SESSION, role: "STAFF" } });
    const res = await PATCH(req({ active: false }), { params: { id: "user_staff1" } });
    expect(res.status).toBe(403);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("6. a staff member from another firm is rejected — 404, nothing updated (findFirst's own where-clause enforces this)", async () => {
    mockUserFindFirst.mockResolvedValue(null); // not found under this firmId
    const res = await PATCH(req({ role: "MANAGER" }), { params: { id: "someone_elses_staff" } });
    expect(res.status).toBe(404);
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockUserFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "someone_elses_staff", firmId: "firm_1" } }));
  });

  it("7. an invalid role value is rejected — 400, nothing updated", async () => {
    const res = await PATCH(req({ role: "SUPERADMIN" }), { params: { id: "user_staff1" } });
    expect(res.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("10a. role change is recorded via the existing recordActivity/STAFF_UPDATED — no new event type", async () => {
    await PATCH(req({ role: "MANAGER" }), { params: { id: "user_staff1" } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "STAFF", eventType: "STAFF_UPDATED", metadata: expect.objectContaining({ after: { role: "MANAGER" } }) })
    );
  });

  it("10b. deactivation is recorded via the existing recordActivity/STAFF_UPDATED and logAudit — no new mechanism", async () => {
    await PATCH(req({ active: false }), { params: { id: "user_staff1" } });
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "STAFF_UPDATED" }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "staff.role_change" }));
  });

  it("a no-op PATCH (empty body) still succeeds without recording a spurious activity", async () => {
    const res = await PATCH(req({}), { params: { id: "user_staff1" } });
    expect(res.status).toBe(200);
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
