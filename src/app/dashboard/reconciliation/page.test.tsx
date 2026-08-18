import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockMatchFindMany = vi.fn();
const mockMatchCount = vi.fn();
const mockClientFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reconciliationMatch: {
      findMany: (...a: unknown[]) => mockMatchFindMany(...a),
      count: (...a: unknown[]) => mockMatchCount(...a),
    },
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
  },
}));

import ReconciliationExceptionsPage from "./page";
import ReconciliationFilterBar from "@/components/ReconciliationFilterBar";
import Pagination from "@/components/Pagination";
import { ReconciliationMatchButtons } from "@/components/ReconciliationMatchButtons";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";

// Both helpers expand non-hook function components (Pagination,
// ReconciliationMatchList) so nested content is visible, same rationale as
// textOf below. Hook-bearing components (ReconciliationFilterBar,
// ReconciliationMatchButtons) throw when invoked directly outside a real
// render — caught, left unexpanded — so structural checks for *those* use
// findAllByType against the element itself (type + props), never their
// rendered output.
function findAllByProp(node: unknown, propName: string, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByProp(n, propName, out);
    return out;
  }
  const el = node as any;
  if (el.props?.[propName] !== undefined) out.push(el);
  if (typeof el.type === "function") {
    try {
      findAllByProp(el.type(el.props), propName, out);
      return out;
    } catch {
      // hook-bearing — fall through to children below
    }
  }
  if (el.props?.children !== undefined) findAllByProp(el.props.children, propName, out);
  return out;
}

function findAllByType(node: unknown, type: unknown, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByType(n, type, out);
    return out;
  }
  const el = node as any;
  if (el.type === type) out.push(el);
  if (el.type !== type && typeof el.type === "function") {
    try {
      findAllByType(el.type(el.props), type, out);
      return out;
    } catch {
      // hook-bearing — fall through to children below
    }
  }
  if (el.props?.children !== undefined) findAllByType(el.props.children, type, out);
  return out;
}

// Expands function-component elements (e.g. Pagination, ReconciliationMatchList
// — neither is "use client"/hook-bearing, so calling them directly is safe)
// so their own rendered text is visible to assertions on the page's tree.
// Hook-bearing components like ReconciliationFilterBar throw when invoked
// outside a real render — caught and treated as opaque (no children prop to
// fall back into either, so they simply contribute no text), which is fine
// since these tests only assert on ReconciliationFilterBar's *props*, not
// its rendered text.
function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) {
    const el = node as any;
    if (typeof el.type === "function") {
      try {
        return textOf(el.type(el.props));
      } catch {
        return textOf(el.props?.children);
      }
    }
    return textOf(el.props?.children);
  }
  return "";
}

const FIRM_ID = "firm_1";

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match_1",
    riskScore: 75,
    exceptionReason: "AMOUNT_MISMATCH",
    exceptionExplanation: "Amount differs by ₹500",
    reconciliationRun: { type: "GST_2B_VS_PURCHASE", periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-06-30"), client: { id: "client_1", name: "Acme" } },
    task: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockMatchFindMany.mockResolvedValue([]);
  mockMatchCount.mockResolvedValue(0);
  mockClientFindMany.mockResolvedValue([{ id: "client_1", name: "Acme" }]);
});

describe("Reconciliation Exceptions queue — Batch B item 3: link to the escalated Task (preserved)", () => {
  it("links to the Task when a match has one", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch({ task: { id: "task_1", title: "GSTR-3B mismatch follow-up" } })]);
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const links = findAllByProp(tree, "href").filter((el) => el.props.href === "/dashboard/tasks/task_1");
    expect(links.length).toBeGreaterThan(0);
  });

  it("shows no task link when the match has none (below-threshold exceptions never got escalated)", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch({ task: null })]);
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const taskLinks = findAllByProp(tree, "href").filter((el) => typeof el.props.href === "string" && el.props.href.startsWith("/dashboard/tasks/"));
    expect(taskLinks).toHaveLength(0);
  });

  it("the exceptions query stays firm-scoped via the reconciliation run relation", async () => {
    await ReconciliationExceptionsPage({ searchParams: {} });
    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reconciliationRun: { firmId: FIRM_ID } }) })
    );
  });
});

describe("Batch F1 — A. no filters: existing query/behavior preserved", () => {
  it("queries with exactly the pre-F1 where clause when no filters are present", async () => {
    await ReconciliationExceptionsPage({ searchParams: {} });
    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "EXCEPTION", reconciliationRun: { firmId: FIRM_ID } } })
    );
  });

  it("preserves ordering, resolve/ignore controls, risk badges, and explanation text", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch()]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const [{ orderBy }] = mockMatchFindMany.mock.calls[0];
    expect(orderBy).toEqual([{ riskScore: "desc" }, { createdAt: "desc" }]);
    expect(textOf(tree)).toContain("Risk 75");
    expect(textOf(tree)).toContain("Amount differs by ₹500");
  });

  it("preserves the unfiltered empty-state copy", async () => {
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    expect(textOf(tree)).toContain("Nothing outstanding.");
  });
});

describe("Batch F1 — B. client filter", () => {
  it("adds clientId to the where clause, ANDed with firmId inside reconciliationRun", async () => {
    await ReconciliationExceptionsPage({ searchParams: { clientId: "client_1" } });
    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reconciliationRun: { firmId: FIRM_ID, clientId: "client_1" } }) })
    );
  });
});

describe("Batch F1 — C. reconciliation type filter", () => {
  it("adds a validated type to the where clause", async () => {
    await ReconciliationExceptionsPage({ searchParams: { type: "BANK_VS_BOOKS" } });
    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reconciliationRun: { firmId: FIRM_ID, type: "BANK_VS_BOOKS" } }) })
    );
  });
});

describe("Batch F1 — D. exception reason filter", () => {
  it("adds a validated reason to the top-level where clause", async () => {
    await ReconciliationExceptionsPage({ searchParams: { reason: "GSTIN_MISMATCH" } });
    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ exceptionReason: "GSTIN_MISMATCH" }) })
    );
  });
});

describe("Batch F1 — E. combined filters", () => {
  it("client + type + reason all land in the same where clause together", async () => {
    await ReconciliationExceptionsPage({ searchParams: { clientId: "client_1", type: "GST_1_VS_SALES", reason: "DUPLICATE" } });
    const [{ where }] = mockMatchFindMany.mock.calls[0];
    expect(where).toEqual({
      status: "EXCEPTION",
      reconciliationRun: { firmId: FIRM_ID, clientId: "client_1", type: "GST_1_VS_SALES" },
      exceptionReason: "DUPLICATE",
    });
  });
});

describe("Batch F1 — F/G. pagination pages", () => {
  it("page 1 (default): skip 0, take 50", async () => {
    await ReconciliationExceptionsPage({ searchParams: {} });
    const [{ skip, take }] = mockMatchFindMany.mock.calls[0];
    expect(skip).toBe(0);
    expect(take).toBe(50);
  });

  it("page 2: skip 50, take 50", async () => {
    await ReconciliationExceptionsPage({ searchParams: { page: "2" } });
    const [{ skip, take }] = mockMatchFindMany.mock.calls[0];
    expect(skip).toBe(50);
    expect(take).toBe(50);
  });
});

describe("Batch F1 — H. total count", () => {
  it("count() runs with the same where clause as findMany, for an accurate total", async () => {
    await ReconciliationExceptionsPage({ searchParams: { clientId: "client_1" } });
    const [{ where: findWhere }] = mockMatchFindMany.mock.calls[0];
    const [{ where: countWhere }] = mockMatchCount.mock.calls[0];
    expect(countWhere).toEqual(findWhere);
  });

  it("renders the total result count and current page in the pagination footer", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch()]);
    mockMatchCount.mockResolvedValue(73);
    const tree = await ReconciliationExceptionsPage({ searchParams: { page: "2" } });
    const text = textOf(tree);
    expect(text).toContain("73 results");
    expect(text).toContain("Page 2 of 2");
  });
});

describe("Batch F1 — I. no results", () => {
  it("a filter combination with zero matches shows the filtered empty state, not the generic one", async () => {
    mockMatchFindMany.mockResolvedValue([]);
    mockMatchCount.mockResolvedValue(0);
    const tree = await ReconciliationExceptionsPage({ searchParams: { clientId: "client_1" } });
    const text = textOf(tree);
    expect(text).toContain("No exceptions match the selected filters.");
    expect(text).not.toContain("Nothing outstanding.");
  });

  it("pagination renders nothing (Pagination itself returns null) when there are zero total results", async () => {
    mockMatchFindMany.mockResolvedValue([]);
    mockMatchCount.mockResolvedValue(0);
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const paginations = findAllByType(tree, Pagination);
    expect(paginations).toHaveLength(1); // the <Pagination> element is still in the page's tree...
    expect(Pagination(paginations[0].props)).toBeNull(); // ...but it renders nothing for total:0
    expect(textOf(tree)).not.toContain("results");
  });
});

describe("Batch F1 — J. invalid filter values", () => {
  it("an invalid reconciliation type is ignored, not passed to Prisma", async () => {
    await ReconciliationExceptionsPage({ searchParams: { type: "NOT_A_REAL_TYPE" } });
    const [{ where }] = mockMatchFindMany.mock.calls[0];
    expect(where.reconciliationRun).toEqual({ firmId: FIRM_ID });
  });

  it("an invalid exception reason is ignored, not passed to Prisma", async () => {
    await ReconciliationExceptionsPage({ searchParams: { reason: "NOT_A_REAL_REASON" } });
    const [{ where }] = mockMatchFindMany.mock.calls[0];
    expect(where.exceptionReason).toBeUndefined();
  });
});

describe("Batch F1 — K. invalid page", () => {
  it("a non-numeric page falls back to page 1", async () => {
    await ReconciliationExceptionsPage({ searchParams: { page: "not-a-number" } });
    const [{ skip }] = mockMatchFindMany.mock.calls[0];
    expect(skip).toBe(0);
  });

  it("a negative/zero page falls back to page 1", async () => {
    await ReconciliationExceptionsPage({ searchParams: { page: "-5" } });
    const [{ skip }] = mockMatchFindMany.mock.calls[0];
    expect(skip).toBe(0);
  });

  it("a page far beyond the total doesn't crash — just an empty page with correct pagination info", async () => {
    mockMatchFindMany.mockResolvedValue([]);
    mockMatchCount.mockResolvedValue(3);
    const tree = await ReconciliationExceptionsPage({ searchParams: { page: "999" } });
    expect(textOf(tree)).toContain("Page 999 of 1");
  });
});

describe("Batch F1 — L. cross-firm client cannot leak data", () => {
  it("a cross-firm/nonexistent clientId is still ANDed with this session's firmId — structurally can never match another firm's row", async () => {
    await ReconciliationExceptionsPage({ searchParams: { clientId: "someone_elses_client" } });
    const [{ where }] = mockMatchFindMany.mock.calls[0];
    expect(where.reconciliationRun.firmId).toBe(FIRM_ID);
    expect(where.reconciliationRun.clientId).toBe("someone_elses_client");
  });

  it("the client filter dropdown options come from a firm-scoped client query, not from scanning matches", async () => {
    await ReconciliationExceptionsPage({ searchParams: {} });
    expect(mockClientFindMany).toHaveBeenCalledWith({ where: { firmId: FIRM_ID }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  });
});

describe("Batch F1 — N. Resolve/Ignore and O. Task links remain available", () => {
  it("ReconciliationMatchButtons is still wired up (structurally) for each match, with the correct match id", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch({ id: "match_7", task: { id: "task_1", title: "Follow up" } })]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const buttons = findAllByType(tree, ReconciliationMatchButtons);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.id).toBe("match_7");
  });

  it("the Task link is present and reachable through the expanded tree", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch({ task: { id: "task_1", title: "Follow up" } })]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    expect(textOf(tree)).toContain("View task: Follow up");
    expect(findAllByProp(tree, "href").some((l) => l.props.href === "/dashboard/tasks/task_1")).toBe(true);
  });
});

describe("Batch F1 — P. no N+1: exactly 3 queries regardless of result size or filters", () => {
  it("findMany + count + client.findMany run exactly once each", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch(), baseMatch({ id: "match_2" }), baseMatch({ id: "match_3" })]);
    mockMatchCount.mockResolvedValue(3);
    await ReconciliationExceptionsPage({ searchParams: { clientId: "client_1", type: "BANK_VS_BOOKS", reason: "DUPLICATE" } });
    expect(mockMatchFindMany).toHaveBeenCalledTimes(1);
    expect(mockMatchCount).toHaveBeenCalledTimes(1);
    expect(mockClientFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("Batch F1 — reusable filter bar and pagination wiring", () => {
  it("renders ReconciliationFilterBar with the full enums and the firm's own clients", async () => {
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const bars = findAllByType(tree, ReconciliationFilterBar);
    expect(bars).toHaveLength(1);
    expect(bars[0].props.reconciliationTypes).toEqual(["GST_2B_VS_PURCHASE", "GST_1_VS_SALES", "BANK_VS_BOOKS"]);
    expect(bars[0].props.exceptionReasons).toEqual([
      "MISSING_IN_BOOKS", "MISSING_IN_SOURCE", "AMOUNT_MISMATCH", "DATE_MISMATCH", "GSTIN_MISMATCH", "DUPLICATE", "RATE_MISMATCH",
    ]);
    expect(bars[0].props.clients).toEqual([{ id: "client_1", name: "Acme" }]);
  });

  it("passes the raw searchParams through to Pagination for href-building", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch()]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationExceptionsPage({ searchParams: { clientId: "client_1", page: "1" } });
    const paginations = findAllByType(tree, Pagination);
    expect(paginations).toHaveLength(1);
    expect(paginations[0].props.pathname).toBe("/dashboard/reconciliation");
    expect(paginations[0].props.searchParams).toEqual({ clientId: "client_1", page: "1" });
  });
});

describe("F2 Security Refinement — Upload tab visibility from the Exceptions page", () => {
  it("PARTNER gets canManageReconciliation:true", async () => {
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const navs = findAllByType(tree, ReconciliationSubNav);
    expect(navs[0].props.canManageReconciliation).toBe(true);
  });

  it("MANAGER gets canManageReconciliation:true", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "MANAGER", email: "m@firm.test" });
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const navs = findAllByType(tree, ReconciliationSubNav);
    expect(navs[0].props.canManageReconciliation).toBe(true);
  });

  it("STAFF gets canManageReconciliation:false", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await ReconciliationExceptionsPage({ searchParams: {} });
    const navs = findAllByType(tree, ReconciliationSubNav);
    expect(navs[0].props.canManageReconciliation).toBe(false);
  });
});
