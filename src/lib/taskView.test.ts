import { describe, expect, it } from "vitest";
import { resolveTaskView } from "./taskView";

describe("resolveTaskView", () => {
  it("defaults STAFF to My Work when nothing is requested", () => {
    expect(resolveTaskView(undefined, "STAFF")).toBe("mine");
  });

  it("defaults PARTNER to All Tasks when nothing is requested", () => {
    expect(resolveTaskView(undefined, "PARTNER")).toBe("all");
  });

  it("defaults MANAGER to All Tasks when nothing is requested", () => {
    expect(resolveTaskView(undefined, "MANAGER")).toBe("all");
  });

  it("an explicit valid request always wins over the role default", () => {
    expect(resolveTaskView("all", "STAFF")).toBe("all");
    expect(resolveTaskView("mine", "PARTNER")).toBe("mine");
  });

  it("falls back to the role default for an invalid/garbage value", () => {
    expect(resolveTaskView("nonsense", "STAFF")).toBe("mine");
    expect(resolveTaskView("", "PARTNER")).toBe("all");
  });
});
