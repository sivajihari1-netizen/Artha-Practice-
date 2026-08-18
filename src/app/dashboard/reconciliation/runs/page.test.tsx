import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockRunFindMany = vi.fn();
const mockRunCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reconciliationRun: {
      findMany: (...a: unknown[]) => mockRunFindMany(...a),
      count: (...a: unknown[]) => mockRunCount(...a),
    },
  },
}));

import ReconciliationRunsPage from "./page";
import Pagination from "@/components/Pagination";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";

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
      // hook-bearing — leave unexpanded
    }
  }
  if (el.props?.children !== undefined) findAllByType(el.props.children, type, out);
  return out;
}

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
      // hook-bearing — leave unexpanded
    }
  }
  if (el.props?.children !== undefined) findAllByProp(el.props.children, propName, out);
  return out;
}

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

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run_1",
    type: "GST_2B_VS_PURCHASE",
    periodStart: new Date("2026-06-01"),
    periodEnd: new Date("2026-06-30"),
    status: "MATCHED",
    matchedCount: 40,
    exceptionCount: 3,
    errorMessage: null,
    createdAt: new Date("2026-07-01"),
    client: { id: "client_1", name: "Acme" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockRunFindMany.mockResolvedValue([]);
  mockRunCount.mockResolvedValue(0);
});

describe("Reconciliation Runs list — firm isolation", () => {
  it("queries runs scoped to the session firmId only", async () => {
    await ReconciliationRunsPage({ searchParams: {} });
    expect(mockRunFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { firmId: FIRM_ID } }));
    expect(mockRunCount).toHaveBeenCalledWith({ where: { firmId: FIRM_ID } });
  });
});

describe("Reconciliation Runs list — renders runs", () => {
  it("renders client, type, status, matched/exception counts for each run", async () => {
    mockRunFindMany.mockResolvedValue([run()]);
    mockRunCount.mockResolvedValue(1);
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    const text = textOf(tree);
    expect(text).toContain("Acme");
    expect(text).toContain("GSTR-2B vs Purchase Register");
    expect(text).toContain("Matched");
    expect(text).toContain("40");
    expect(text).toContain("3");
  });

  it("each run links to its own detail page", async () => {
    mockRunFindMany.mockResolvedValue([run({ id: "run_42" })]);
    mockRunCount.mockResolvedValue(1);
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    const hrefs = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(hrefs).toContain("/dashboard/reconciliation/runs/run_42");
  });

  it("shows the error message for a failed run", async () => {
    mockRunFindMany.mockResolvedValue([run({ status: "FAILED", errorMessage: "Couldn't map any recognizable columns." })]);
    mockRunCount.mockResolvedValue(1);
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    expect(textOf(tree)).toContain("Couldn't map any recognizable columns.");
  });
});

describe("Reconciliation Runs list — empty state", () => {
  it("shows an empty state pointing at Upload when there are no runs", async () => {
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    expect(textOf(tree)).toContain("No reconciliation runs yet.");
  });
});

describe("Reconciliation Runs list — pagination", () => {
  it("page 1: skip 0, take 20", async () => {
    await ReconciliationRunsPage({ searchParams: {} });
    const [{ skip, take }] = mockRunFindMany.mock.calls[0];
    expect(skip).toBe(0);
    expect(take).toBe(20);
  });

  it("page 2: skip 20", async () => {
    await ReconciliationRunsPage({ searchParams: { page: "2" } });
    const [{ skip }] = mockRunFindMany.mock.calls[0];
    expect(skip).toBe(20);
  });

  it("reuses the F1 Pagination component", async () => {
    mockRunFindMany.mockResolvedValue([run()]);
    mockRunCount.mockResolvedValue(1);
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    const paginations = findAllByType(tree, Pagination);
    expect(paginations).toHaveLength(1);
    expect(paginations[0].props.pathname).toBe("/dashboard/reconciliation/runs");
  });

  it("an invalid page value falls back to page 1", async () => {
    await ReconciliationRunsPage({ searchParams: { page: "not-a-number" } });
    const [{ skip }] = mockRunFindMany.mock.calls[0];
    expect(skip).toBe(0);
  });
});

describe("Reconciliation Runs list — no N+1", () => {
  it("exactly one findMany and one count regardless of row count", async () => {
    mockRunFindMany.mockResolvedValue([run(), run({ id: "run_2" }), run({ id: "run_3" })]);
    mockRunCount.mockResolvedValue(3);
    await ReconciliationRunsPage({ searchParams: {} });
    expect(mockRunFindMany).toHaveBeenCalledTimes(1);
    expect(mockRunCount).toHaveBeenCalledTimes(1);
  });
});

describe("Reconciliation Runs list — F2 Security Refinement: Upload tab visibility", () => {
  it("PARTNER gets canManageReconciliation:true", async () => {
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    expect(findAllByType(tree, ReconciliationSubNav)[0].props.canManageReconciliation).toBe(true);
  });

  it("MANAGER gets canManageReconciliation:true", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "MANAGER", email: "m@firm.test" });
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    expect(findAllByType(tree, ReconciliationSubNav)[0].props.canManageReconciliation).toBe(true);
  });

  it("STAFF gets canManageReconciliation:false, but still sees the run list itself", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    mockRunFindMany.mockResolvedValue([run()]);
    mockRunCount.mockResolvedValue(1);
    const tree = await ReconciliationRunsPage({ searchParams: {} });
    expect(findAllByType(tree, ReconciliationSubNav)[0].props.canManageReconciliation).toBe(false);
    expect(textOf(tree)).toContain("Acme"); // full view access preserved for STAFF
  });
});
