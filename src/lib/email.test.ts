import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNotificationLogCreate = vi.fn();
const mockNotificationLogUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationLog: {
      create: (...a: unknown[]) => mockNotificationLogCreate(...a),
      update: (...a: unknown[]) => mockNotificationLogUpdate(...a),
    },
  },
}));

const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn((..._args: unknown[]) => ({ sendMail: mockSendMail }));
vi.mock("nodemailer", () => ({
  default: { createTransport: (...a: unknown[]) => mockCreateTransport(...a) },
  createTransport: (...a: unknown[]) => mockCreateTransport(...a),
}));

import { sendEmail } from "./email";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mockNotificationLogCreate.mockResolvedValue({ id: "log_1" });
  mockNotificationLogUpdate.mockResolvedValue({});
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendEmail — stub mode (SMTP_HOST unset)", () => {
  it("never attempts real SMTP, marks the NotificationLog SENT, and reports stub:true so callers can distinguish it from real delivery", async () => {
    const result = await sendEmail({ to: "a@test.local", subject: "Hi", body: "<p>hi</p>" });

    expect(result).toEqual({ ok: true, stub: true });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockNotificationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED" }) })
    );
    expect(mockNotificationLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({ status: "SENT" }),
    });
  });
});

describe("sendEmail — SMTP configured (SMTP_HOST set)", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "resend";
    process.env.SMTP_PASS = "test-key-not-real";
    process.env.EMAIL_FROM = "no-reply@arthapractice.in";
  });

  it("attempts real SMTP delivery via nodemailer using exactly the 5 documented env vars, and reports plain ok:true (no stub flag) on success", async () => {
    mockSendMail.mockResolvedValue({});

    const result = await sendEmail({ to: "a@test.local", subject: "Hi", body: "<p>hi</p>" });

    expect(result).toEqual({ ok: true });
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "resend", pass: "test-key-not-real" },
      connectionTimeout: 10_000,
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "no-reply@arthapractice.in", to: "a@test.local", subject: "Hi", html: "<p>hi</p>" })
    );
    expect(mockNotificationLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({ status: "SENT" }),
    });
  });

  it("port 465 uses implicit TLS (secure:true) — required for delivery to work at all on that port, not just cosmetic", async () => {
    process.env.SMTP_PORT = "465";
    mockSendMail.mockResolvedValue({});

    await sendEmail({ to: "a@test.local", subject: "Hi", body: "<p>hi</p>" });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true })
    );
  });

  it("on SMTP failure, marks the NotificationLog FAILED (never a false SENT) and returns ok:false with the error", async () => {
    mockSendMail.mockRejectedValue(new Error("connection refused"));

    const result = await sendEmail({ to: "a@test.local", subject: "Hi", body: "<p>hi</p>" });

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain("connection refused");
    expect(mockNotificationLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({ status: "FAILED", error: expect.stringContaining("connection refused") }),
    });
    // Never both — a failure must not also produce a SENT update.
    const statuses = mockNotificationLogUpdate.mock.calls.map((c) => (c[0] as { data: { status: string } }).data.status);
    expect(statuses).not.toContain("SENT");
  });
});
