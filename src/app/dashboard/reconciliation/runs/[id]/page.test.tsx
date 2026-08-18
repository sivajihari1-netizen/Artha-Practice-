import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockRunFindFirst = vi.fn();
const mockMatchFindMany = vi.fn();
const mockMatchCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reconciliationRun: { findFirst: (...a: unknown[]) => mockRunFindFirst(...a) },
    reconciliationMatch: {
      findMany: (...a: unknown[]) => mockMatchFindMany(...a),
      count: (...a: unknown[]) => mockMatchCount(...a),
    },
  },
}));

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => mockNotFound() }));

import ReconciliationRunDetailPage from "./page";
import ReconciliationMatchList from "@/components/ReconciliationMatchList";
import Pagination from "@/components/Pagination";
import ReconciliationRerunButton from "@/components/ReconciliationRerunButton";
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
const RUN_ID = "run_1";

function baseRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    firmId: FIRM_ID,
    type: "GST_2B_VS_PURCHASE",
    periodStart: new Date("2026-06-01"),
    periodEnd: new Date("2026-06-30"),
    status: "MATCHED",
    matchedCount: 40,
    exceptionCount: 3,
    errorMessage: null,
    createdAt: new Date("2026-07-01"),
    client: { id: "client_1", name: "Acme" },
    sourceADocument: { id: "doc_a", fileName: "gstr2b.csv" },
    sourceBDocument: { id: "doc_b", fileName: "purchase-register.csv" },
    ...overrides,
  };
}

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match_1",
    riskScore: 60,
    exceptionReason: "AMOUNT_MISMATCH",
    exceptionExplanation: "Amount differs",
    reconciliationRun: { type: "GST_2B_VS_PURCHASE", periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-06-30"), client: { id: "client_1", name: "Acme" } },
    task: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockRunFindFirst.mockResolvedValue(baseRun());
  mockMatchFindMany.mockResolvedValue([]);
  mockMatchCount.mockResolvedValue(0);
});

describe("Run detail — firm isolation", () => {
  it("looks up the run scoped to id + this session's firmId", async () => {
    await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(mockRunFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: RUN_ID, firmId: FIRM_ID } }));
  });

  it("a cross-firm run id calls notFound(), never renders the run", async () => {
    mockRunFindFirst.mockResolvedValue(null);
    await expect(ReconciliationRunDetailPage({ params: { id: "other_firms_run" }, searchParams: {} })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    expect(mockMatchFindMany).not.toHaveBeenCalled();
  });

  it("a nonexistent run id also calls notFound()", async () => {
    mockRunFindFirst.mockResolvedValue(null);
    await expect(ReconciliationRunDetailPage({ params: { id: "does_not_exist" }, searchParams: {} })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("the exceptions query is scoped to this run's id", async () => {
    await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const [{ where }] = mockMatchFindMany.mock.calls[0];
    expect(where).toEqual({ reconciliationRunId: RUN_ID, status: "EXCEPTION" });
  });
});

describe("Run detail — header/summary", () => {
  it("shows client, type, period, status, matched/exception counts", async () => {
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const text = textOf(tree);
    expect(text).toContain("Acme");
    expect(text).toContain("GSTR-2B vs Purchase Register");
    expect(text).toContain("Matched");
    expect(text).toContain("40");
    expect(text).toContain("Exceptions");
    expect(text).toContain("3");
  });

  it("links the client name to Client 360", async () => {
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const hrefs = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(hrefs).toContain("/dashboard/clients/client_1");
  });

  it("shows the error message for a FAILED run without a stack trace", async () => {
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "FAILED", errorMessage: "File has no data rows." }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const text = textOf(tree);
    expect(text).toContain("File has no data rows.");
    expect(text).not.toContain("at Object.<anonymous>"); // sanity check — no raw stack trace shape leaks through
  });
});

describe("Run detail — exceptions (F1 reuse)", () => {
  it("renders exceptions via ReconciliationMatchList unmodified", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch()]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const lists = findAllByType(tree, ReconciliationMatchList);
    expect(lists).toHaveLength(1);
    expect(lists[0].props.matches).toHaveLength(1);
  });

  it("paginates via the F1 Pagination component, scoped to this run's own path", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch()]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const paginations = findAllByType(tree, Pagination);
    expect(paginations).toHaveLength(1);
    expect(paginations[0].props.pathname).toBe(`/dashboard/reconciliation/runs/${RUN_ID}`);
  });

  it("page 2: skip 50", async () => {
    await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: { page: "2" } });
    const [{ skip, take }] = mockMatchFindMany.mock.calls[0];
    expect(skip).toBe(50);
    expect(take).toBe(50);
  });

  it("preserves Resolve/Ignore, risk badges and Task links via the reused component (structural)", async () => {
    mockMatchFindMany.mockResolvedValue([baseMatch({ task: { id: "task_1", title: "Follow up" } })]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(textOf(tree)).toContain("Risk 60");
    expect(textOf(tree)).toContain("View task: Follow up");
  });

  it("shows a no-exceptions message when the run genuinely has none", async () => {
    mockRunFindFirst.mockResolvedValue(baseRun({ exceptionCount: 0 }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(textOf(tree)).toContain("No exceptions on this run.");
  });

  it("distinguishes 'no exceptions at all' from 'this page of results is empty'", async () => {
    // exceptionCount:3 but the query for this page returned none (e.g. a
    // stale/out-of-range page) — the message should reflect the latter, not
    // falsely claim the run has zero exceptions.
    mockRunFindFirst.mockResolvedValue(baseRun({ exceptionCount: 3 }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: { page: "5" } });
    expect(textOf(tree)).toContain("No exceptions on this run's current page.");
  });
});

describe("Run detail — rerun availability (F2.6)", () => {
  it("shows the Rerun button for a completed run", async () => {
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "MATCHED" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const buttons = findAllByType(tree, ReconciliationRerunButton);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.runId).toBe(RUN_ID);
  });

  it("hides the Rerun button while still UPLOADED (mirrors the API's own 409 gate)", async () => {
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "UPLOADED" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(findAllByType(tree, ReconciliationRerunButton)).toHaveLength(0);
  });

  it("hides the Rerun button while EXTRACTING", async () => {
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "EXTRACTING" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(findAllByType(tree, ReconciliationRerunButton)).toHaveLength(0);
  });
});

describe("Run detail — F2 Security Refinement: Rerun and Upload-tab role gating", () => {
  it("PARTNER sees Rerun when the run is otherwise eligible", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "MATCHED" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(findAllByType(tree, ReconciliationRerunButton)).toHaveLength(1);
  });

  it("MANAGER sees Rerun when the run is otherwise eligible", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "MANAGER", email: "m@firm.test" });
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "MATCHED" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(findAllByType(tree, ReconciliationRerunButton)).toHaveLength(1);
  });

  it("STAFF never sees Rerun, even when the run is otherwise eligible", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "MATCHED" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(findAllByType(tree, ReconciliationRerunButton)).toHaveLength(0);
  });

  it("STAFF + an otherwise-eligible status still shows no Rerun button — role gate and status gate both apply", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "CLOSED" }));
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    expect(findAllByType(tree, ReconciliationRerunButton)).toHaveLength(0);
  });

  it("STAFF still has full view access to the run's header, summary, and exceptions", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    mockRunFindFirst.mockResolvedValue(baseRun({ status: "MATCHED" }));
    mockMatchFindMany.mockResolvedValue([baseMatch()]);
    mockMatchCount.mockResolvedValue(1);
    const tree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const text = textOf(tree);
    expect(text).toContain("Acme");
    expect(text).toContain("Risk 60");
  });

  it("passes canManageReconciliation through to the subnav (STAFF:false, PARTNER:true)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const staffTree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const staffNavs = findAllByType(staffTree, ReconciliationSubNav);
    expect(staffNavs[0].props.canManageReconciliation).toBe(false);

    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
    const partnerTree = await ReconciliationRunDetailPage({ params: { id: RUN_ID }, searchParams: {} });
    const partnerNavs = findAllByType(partnerTree, ReconciliationSubNav);
    expect(partnerNavs[0].props.canManageReconciliation).toBe(true);
  });
});
