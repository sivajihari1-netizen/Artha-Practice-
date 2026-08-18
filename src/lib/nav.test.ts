import { describe, expect, it } from "vitest";
import { NAV, HOME_ITEM, ALWAYS_EXPANDED_CATEGORY } from "./nav";

// Directly guards the audit's headline finding from regressing silently:
// Reconciliation Exceptions and Task Templates must always have a real nav
// leaf somewhere in NAV — this is the one navigation config now, so if
// either of these hrefs stops appearing here, they become unreachable again.
function allHrefs(): string[] {
  return NAV.flatMap((category) => category.children.map((leaf) => leaf.href));
}

describe("NAV — single canonical navigation", () => {
  it("includes Reconciliation Exceptions (the P0 fix)", () => {
    expect(allHrefs()).toContain("/dashboard/reconciliation");
  });

  it("includes Task Templates (the P0 fix)", () => {
    expect(allHrefs()).toContain("/dashboard/tasks/templates");
  });

  it("every leaf href is unique — no duplicate paths to the same page", () => {
    const hrefs = allHrefs();
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("every category has at least one child", () => {
    for (const category of NAV) {
      expect(category.children.length).toBeGreaterThan(0);
    }
  });

  it("HOME_ITEM points at the dashboard root and is not duplicated inside NAV", () => {
    expect(HOME_ITEM.href).toBe("/dashboard");
    expect(allHrefs()).not.toContain(HOME_ITEM.href);
  });

  it("ALWAYS_EXPANDED_CATEGORY refers to a real category in NAV", () => {
    expect(NAV.map((c) => c.label)).toContain(ALWAYS_EXPANDED_CATEGORY);
  });

  it("Subscription (billing) stays Partner-only, matching Step 3's 'no unnecessary platform billing controls for Manager'", () => {
    const firmOps = NAV.find((c) => c.label === "Firm Operations")!;
    const subscription = firmOps.children.find((leaf) => leaf.href === "/dashboard/billing")!;
    expect(subscription.roles).toEqual(["PARTNER"]);
  });

  it("Reports has no role restriction — visible to STAFF too (scoped at the query level, not the nav level)", () => {
    const firmOps = NAV.find((c) => c.label === "Firm Operations")!;
    const reports = firmOps.children.find((leaf) => leaf.href === "/dashboard/reports")!;
    expect(reports.roles).toBeUndefined();
  });
});
