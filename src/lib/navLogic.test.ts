import { describe, expect, it } from "vitest";
import { visibleFor, activeCategoryLabel, initialExpandedCategories } from "./navLogic";
import type { NavCategory } from "./nav";

const CATEGORIES: NavCategory[] = [
  {
    label: "Work",
    children: [
      { href: "/dashboard/tasks", label: "Tasks" },
      { href: "/dashboard/tasks/templates", label: "Task Templates" },
    ],
  },
  {
    label: "Clients",
    children: [{ href: "/dashboard/clients", label: "Clients" }],
  },
  {
    label: "Firm Operations",
    children: [
      { href: "/dashboard/staff", label: "Staff", roles: ["PARTNER", "MANAGER"] },
      { href: "/dashboard/notifications", label: "Notifications", roles: ["PARTNER", "MANAGER"] },
      { href: "/dashboard/reports", label: "Reports" }, // no roles — visible to everyone
    ],
  },
  {
    label: "Partner Only Category",
    roles: ["PARTNER"],
    children: [{ href: "/dashboard/x", label: "X" }],
  },
];

describe("visibleFor — role-based filtering", () => {
  it("PARTNER sees every category and every leaf", () => {
    const result = visibleFor(CATEGORIES, "PARTNER");
    expect(result.map((c) => c.label)).toEqual(["Work", "Clients", "Firm Operations", "Partner Only Category"]);
    const firmOps = result.find((c) => c.label === "Firm Operations")!;
    expect(firmOps.children.map((c) => c.label)).toEqual(["Staff", "Notifications", "Reports"]);
  });

  it("STAFF does not see Firm-Ops-only leaves, but still sees Firm Operations because Reports remains", () => {
    const result = visibleFor(CATEGORIES, "STAFF");
    const firmOps = result.find((c) => c.label === "Firm Operations");
    expect(firmOps).toBeDefined();
    expect(firmOps!.children.map((c) => c.label)).toEqual(["Reports"]);
  });

  it("STAFF does not see unrestricted categories filtered — Work and Clients remain fully intact", () => {
    const result = visibleFor(CATEGORIES, "STAFF");
    expect(result.find((c) => c.label === "Work")?.children).toHaveLength(2);
    expect(result.find((c) => c.label === "Clients")?.children).toHaveLength(1);
  });

  it("drops a category entirely once role filtering leaves it with zero children (the empty-category edge case)", () => {
    const categoriesWithAnAllRestrictedCategory: NavCategory[] = [
      {
        label: "Only For Managers",
        children: [
          { href: "/dashboard/a", label: "A", roles: ["PARTNER"] },
          { href: "/dashboard/b", label: "B", roles: ["PARTNER", "MANAGER"] },
        ],
      },
      { label: "Everyone", children: [{ href: "/dashboard/c", label: "C" }] },
    ];
    const result = visibleFor(categoriesWithAnAllRestrictedCategory, "STAFF");
    expect(result.map((c) => c.label)).toEqual(["Everyone"]);
  });

  it("a category-level role restriction hides the whole category regardless of child roles", () => {
    const result = visibleFor(CATEGORIES, "MANAGER");
    expect(result.find((c) => c.label === "Partner Only Category")).toBeUndefined();
  });

  it("STAFF sees the category-restricted item correctly excluded, PARTNER sees it included", () => {
    expect(visibleFor(CATEGORIES, "STAFF").find((c) => c.label === "Partner Only Category")).toBeUndefined();
    expect(visibleFor(CATEGORIES, "PARTNER").find((c) => c.label === "Partner Only Category")).toBeDefined();
  });
});

describe("activeCategoryLabel — active-route detection", () => {
  it("matches an exact leaf href", () => {
    expect(activeCategoryLabel(CATEGORIES, "/dashboard/clients")).toBe("Clients");
  });

  it("matches a sub-route via prefix (e.g. a detail page not itself in the nav)", () => {
    expect(activeCategoryLabel(CATEGORIES, "/dashboard/clients/abc123")).toBe("Clients");
  });

  it("prefers the most specific (longest) href when two leaves could both prefix-match", () => {
    // "/dashboard/tasks/templates/xyz" starts with both "/dashboard/tasks" and
    // "/dashboard/tasks/templates" — the latter, more specific leaf should win,
    // even though both leaves happen to live in the same category here.
    expect(activeCategoryLabel(CATEGORIES, "/dashboard/tasks/templates/xyz")).toBe("Work");
  });

  it("does not false-positive match a route that only shares a text prefix, not a path segment", () => {
    // "/dashboard/tasksomething" should NOT match "/dashboard/tasks" — the
    // leafMatchesPath check requires an exact match or a "/" boundary.
    expect(activeCategoryLabel(CATEGORIES, "/dashboard/tasksomething")).toBeNull();
  });

  it("returns null for a route outside every category (e.g. Home)", () => {
    expect(activeCategoryLabel(CATEGORIES, "/dashboard")).toBeNull();
  });
});

describe("initialExpandedCategories", () => {
  it("always includes the always-expanded category even when it's not active", () => {
    const expanded = initialExpandedCategories({ categories: CATEGORIES, pathname: "/dashboard/clients", alwaysExpandedCategory: "Work" });
    expect(expanded.has("Work")).toBe(true);
    expect(expanded.has("Clients")).toBe(true);
    expect(expanded.size).toBe(2);
  });

  it("does not duplicate when the active category IS the always-expanded one", () => {
    const expanded = initialExpandedCategories({ categories: CATEGORIES, pathname: "/dashboard/tasks", alwaysExpandedCategory: "Work" });
    expect(expanded.size).toBe(1);
    expect(expanded.has("Work")).toBe(true);
  });

  it("on Home (no active category), only the always-expanded category is open", () => {
    const expanded = initialExpandedCategories({ categories: CATEGORIES, pathname: "/dashboard", alwaysExpandedCategory: "Work" });
    expect([...expanded]).toEqual(["Work"]);
  });
});
