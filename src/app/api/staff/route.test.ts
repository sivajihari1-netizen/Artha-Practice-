import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockUserFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...a: unknown[]) => mockUserFindMany(...a),
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      create: (...a: unknown[]) => mockUserCreate(...a),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn().mockResolvedValue("hashed") }));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { STAFF_CREATED: "STAFF_CREATED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { GET, POST } from "./route";

const PARTNER_SESSION = { userId: "user_partner", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: PARTNER_SESSION });
  mockUserFindUnique.mockResolvedValue(null);
  mockUserCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: "user_new",
    name: data.name,
    email: data.email,
    role: data.role,
    active: true,
  }));
});

describe("8. GET/POST /api/staff — unaffected by the Batch A PATCH addition", () => {
  it("lists staff for the firm", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "u1", name: "A", email: "a@firm.test", role: "STAFF", active: true, createdAt: new Date() }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.staff).toHaveLength(1);
  });

  it("a Partner can still create a staff account exactly as before", async () => {
    const res = await POST(req({ name: "New Hire", email: "newhire@firm.test", password: "password123", role: "STAFF" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.role).toBe("STAFF");
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "STAFF_CREATED" }));
  });

  it("a Manager still cannot create a staff account", async () => {
    mockRequireSession.mockReturnValue({ session: { ...PARTNER_SESSION, role: "MANAGER" } });
    const res = await POST(req({ name: "New Hire", email: "newhire@firm.test", password: "password123" }));
    expect(res.status).toBe(403);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("still rejects a duplicate email", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(req({ name: "Dup", email: "dup@firm.test", password: "password123" }));
    expect(res.status).toBe(409);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
