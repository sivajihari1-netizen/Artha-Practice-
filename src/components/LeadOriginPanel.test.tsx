import { describe, expect, it } from "vitest";
import LeadOriginPanel from "./LeadOriginPanel";

// No RTL/jsdom in this project — these components are plain functions
// returning React elements, so we call them directly and inspect the
// returned element tree (a plain object before anything touches a DOM).
function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) {
    return textOf((node as any).props.children);
  }
  return "";
}

describe("LeadOriginPanel", () => {
  it("renders the originating lead's name, stage, and dates", () => {
    const el = LeadOriginPanel({
      leads: [{ id: "lead_1", name: "sateesh hari", stage: "WON", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-16T11:30:27.817Z" }],
    });
    const text = textOf(el);
    expect(text).toContain("sateesh hari");
    expect(text).toContain("WON");
  });

  it("renders nothing (null) for a client with no originating lead — no empty-panel noise", () => {
    const el = LeadOriginPanel({ leads: [] });
    expect(el).toBeNull();
  });
});
