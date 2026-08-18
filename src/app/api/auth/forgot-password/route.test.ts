import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindUnique = vi.fn();
const mockPasswordResetTokenCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    passwordResetToken: { create: (...a: unknown[]) => mockPasswordResetTokenCreate(...a) },
  },
}));

vi.mock("@/lib/auth", () => ({
  generateResetToken: () => "fixed-test-token",
  resetTokenExpiry: () => new Date("2026-01-01T00:30:00Z"),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue({ ok: true });
});

describe("POST /api/auth/forgot-password — no email enumeration", () => {
  it("known, active user: generic success response, sendEmail invoked", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_1", firmId: "firm_1", active: true });
    const res = await POST(req({ email: "real@firm.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email has an Artha account, we've sent a password reset link." });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("unknown email: identical response, sendEmail never invoked", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await POST(req({ email: "nobody@nowhere.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email has an Artha account, we've sent a password reset link." });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("known but inactive user: identical response, sendEmail never invoked", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_2", firmId: "firm_1", active: false });
    const res = await POST(req({ email: "deactivated@firm.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email has an Artha account, we've sent a password reset link." });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sendEmail failing (e.g. real SMTP misconfigured) still returns the identical generic response — failure is never surfaced to the caller", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_1", firmId: "firm_1", active: true });
    mockSendEmail.mockResolvedValue({ ok: false, error: "connection refused" });
    const res = await POST(req({ email: "real@firm.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "If that email has an Artha account, we've sent a password reset link." });
    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("invalid email format: 400, sendEmail never invoked", async () => {
    const res = await POST(req({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
