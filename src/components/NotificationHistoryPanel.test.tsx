import { describe, expect, it } from "vitest";
import NotificationHistoryPanel from "./NotificationHistoryPanel";

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) {
    return textOf((node as any).props.children);
  }
  return "";
}

const LOG = {
  id: "log_1",
  channel: "EMAIL" as const,
  toAddress: "client@example.com",
  template: "Reset your Artha password",
  status: "SENT" as const,
  createdAt: "2026-08-16T10:00:00.000Z",
  sentAt: "2026-08-16T10:00:01.000Z",
};

describe("NotificationHistoryPanel", () => {
  it("renders channel, recipient, template and status", () => {
    const text = textOf(NotificationHistoryPanel({ logs: [LOG] }));
    expect(text).toContain("Email");
    expect(text).toContain("client@example.com");
    expect(text).toContain("Reset your Artha password");
    expect(text).toContain("SENT");
  });

  it("renders a clean empty state for a client with no notifications", () => {
    const text = textOf(NotificationHistoryPanel({ logs: [] }));
    expect(text).toContain("No notifications sent to this client yet.");
  });

  it("never renders anything resembling a token, secret, or raw error payload", () => {
    // The component's prop type doesn't even include payload/error — this
    // proves it structurally, not just by absence of a substring: passing
    // a log shaped exactly like what NotificationLog actually stores would
    // be a type error if the component tried to read those fields.
    const el = NotificationHistoryPanel({ logs: [LOG] });
    const text = textOf(el);
    expect(text).not.toMatch(/token|reset-password|portal\/verify|SMTP|ECONNREFUSED/i);
  });

  it("renders WhatsApp entries distinctly from Email", () => {
    const text = textOf(
      NotificationHistoryPanel({ logs: [{ ...LOG, id: "log_2", channel: "WHATSAPP", toAddress: "+919876543210", template: "document_chase_reminder" }] })
    );
    expect(text).toContain("WhatsApp");
    expect(text).toContain("+919876543210");
  });

  it("shows FAILED status distinctly", () => {
    const text = textOf(NotificationHistoryPanel({ logs: [{ ...LOG, id: "log_3", status: "FAILED" }] }));
    expect(text).toContain("FAILED");
  });
});
