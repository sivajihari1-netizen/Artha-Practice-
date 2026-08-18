import { describe, expect, it } from "vitest";
import RunStatusBadge from "./RunStatusBadge";

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

describe("RunStatusBadge", () => {
  it.each([
    ["UPLOADED", "Uploaded"],
    ["EXTRACTING", "Extracting…"],
    ["EXTRACTED", "Extracted"],
    ["MATCHING", "Matching…"],
    ["MATCHED", "Matched"],
    ["REVIEWED", "Reviewed"],
    ["CLOSED", "Closed"],
    ["FAILED", "Failed"],
  ])("labels %s as %s", (status, label) => {
    expect(textOf(RunStatusBadge({ status }))).toBe(label);
  });

  it("falls back to the raw value for an unrecognized status rather than crashing", () => {
    expect(textOf(RunStatusBadge({ status: "SOME_FUTURE_STATUS" }))).toBe("SOME_FUTURE_STATUS");
  });
});
