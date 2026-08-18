import { describe, expect, it } from "vitest";
import { leadNotePreview } from "./leadNotes";

describe("leadNotePreview", () => {
  it("returns an empty string for null/undefined/blank notes", () => {
    expect(leadNotePreview(null)).toBe("");
    expect(leadNotePreview(undefined)).toBe("");
    expect(leadNotePreview("   ")).toBe("");
  });

  it("returns the trimmed note unchanged when under the max length", () => {
    expect(leadNotePreview("  Budget approved.  ")).toBe("Budget approved.");
  });

  it("truncates with an ellipsis when over the max length", () => {
    const note = "Met CFO on Tuesday. Budget approved. Follow up after 15 August.";
    const preview = leadNotePreview(note, 20);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(21);
  });

  it("respects a custom max length at the boundary", () => {
    expect(leadNotePreview("exactly ten", 11)).toBe("exactly ten");
  });
});
