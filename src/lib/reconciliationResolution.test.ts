import { describe, expect, it } from "vitest";
import { MAX_RESOLUTION_NOTE_LENGTH, buildResolveRequestBody, resolutionNoteError } from "./reconciliationResolution";

describe("buildResolveRequestBody", () => {
  it("omits note entirely when blank", () => {
    expect(buildResolveRequestBody("resolve", "")).toEqual({ action: "resolve" });
  });

  it("omits note when whitespace-only", () => {
    expect(buildResolveRequestBody("ignore", "   \n  ")).toEqual({ action: "ignore" });
  });

  it("includes a trimmed note when present", () => {
    expect(buildResolveRequestBody("resolve", "  Supplier hadn't filed GSTR-1 yet.  ")).toEqual({
      action: "resolve",
      note: "Supplier hadn't filed GSTR-1 yet.",
    });
  });

  it("preserves the requested action for ignore", () => {
    expect(buildResolveRequestBody("ignore", "Immaterial rounding difference")).toEqual({
      action: "ignore",
      note: "Immaterial rounding difference",
    });
  });
});

describe("resolutionNoteError", () => {
  it("returns null for an empty note", () => {
    expect(resolutionNoteError("")).toBeNull();
  });

  it("returns null for a note at exactly the max length", () => {
    expect(resolutionNoteError("a".repeat(MAX_RESOLUTION_NOTE_LENGTH))).toBeNull();
  });

  it("returns an error for a note one character over the max length", () => {
    expect(resolutionNoteError("a".repeat(MAX_RESOLUTION_NOTE_LENGTH + 1))).toContain("too long");
  });

  it("ignores surrounding whitespace when checking length", () => {
    const padded = "  " + "a".repeat(MAX_RESOLUTION_NOTE_LENGTH) + "  ";
    expect(resolutionNoteError(padded)).toBeNull();
  });
});
