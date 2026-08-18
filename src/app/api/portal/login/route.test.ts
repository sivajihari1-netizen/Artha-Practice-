import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockContactFindFirst = vi.fn();
const mockMagicLinkCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contactPerson: { findFirst: (...a: unknown[]) => mockContactFindFirst(...a) },
    clientPortalMagicLink: { create: (...a: unknown[]) => mockMagicLinkCreate(...a) },
  },
}));

vi.mock("@/lib/clientPortalAuth", () => ({
  generateMagicLinkToken: () => "fixed-test-token",
  magicLinkExpiry: () => new Date("2026-01-01T00:15:00Z"),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/portal/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue({ ok: true });
});

describe("POST /api/portal/login — no email enumeration", () => {
  it("known contact: generic success response, sendEmail invoked", async () => {
    mockContactFindFirst.mockResolvedValue({ id: "contact_1", email: "client@company.test" });
    const res = await POST(req({ email: "client@company.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email is on file, we've sent a sign-in link." });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("unknown email: identical response, sendEmail never invoked", async () => {
    mockContactFindFirst.mockResolvedValue(null);
    const res = await POST(req({ email: "nobody@nowhere.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email is on file, we've sent a sign-in link." });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sendEmail failing still returns the identical generic response — failure is never surfaced to the caller", async () => {
    mockContactFindFirst.mockResolvedValue({ id: "contact_1", email: "client@company.test" });
    mockSendEmail.mockResolvedValue({ ok: false, error: "connection refused" });
    const res = await POST(req({ email: "client@company.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email is on file, we've sent a sign-in link." });
    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("invalid email format: 400, sendEmail never invoked", async () => {
    const res = await POST(req({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
