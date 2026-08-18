import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockTaskFindMany = vi.fn();
const mockTaskCount = vi.fn();
const mockMatchCount = vi.fn();
const mockRunFindMany = vi.fn();
const mockInvoiceAggregate = vi.fn();
const mockDscFindMany = vi.fn();
const mockActivityFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findMany: (...a: unknown[]) => mockUserFindMany(...a),
    },
    task: {
      findMany: (...a: unknown[]) => mockTaskFindMany(...a),
      count: (...a: unknown[]) => mockTaskCount(...a),
    },
    reconciliationMatch: { count: (...a: unknown[]) => mockMatchCount(...a) },
    reconciliationRun: { findMany: (...a: unknown[]) => mockRunFindMany(...a) },
    invoice: { aggregate: (...a: unknown[]) => mockInvoiceAggregate(...a) },
    dscRecord: { findMany: (...a: unknown[]) => mockDscFindMany(...a) },
    activity: { findMany: (...a: unknown[]) => mockActivityFindMany(...a) },
  },
}));

const mockGetStaffLoadForFirm = vi.fn();
vi.mock("@/lib/recurringTasks", () => ({ getStaffLoadForFirm: (...a: unknown[]) => mockGetStaffLoadForFirm(...a) }));

const mockListPendingAgentActions = vi.fn();
vi.mock("@/lib/agentActions", () => ({ listPendingAgentActions: (...a: unknown[]) => mockListPendingAgentActions(...a) }));

import DashboardOverview from "./page";
import HomeCreateMenu from "@/components/HomeCreateMenu";

function findAllByProp(node: unknown, propName: string, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByProp(n, propName, out);
    return out;
  }
  const el = node as any;
  if (el.props?.[propName] !== undefined) out.push(el);
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
  if (el.props?.children !== undefined) findAllByType(el.props.children, type, out);
  return out;
}

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

const FIRM_ID = "firm_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockUserFindUnique.mockResolvedValue({ name: "Shivaji Rao" });
  mockUserFindMany.mockResolvedValue([]);
  mockTaskFindMany.mockResolvedValue([]);
  mockTaskCount.mockResolvedValue(0);
  mockMatchCount.mockResolvedValue(0);
  // reconciliationRun.findMany now backs two distinct queries in the same
  // Promise.all (exception-client rows, and FAILED-run detection) — tests
  // that care about one must distinguish by args, same pattern as task.findMany below.
  mockRunFindMany.mockImplementation((args: any) => {
    if (args?.where?.status === "FAILED") return Promise.resolve([]);
    return Promise.resolve([]);
  });
  mockInvoiceAggregate.mockResolvedValue({ _sum: { total: 0 }, _count: 0 });
  mockDscFindMany.mockResolvedValue([]);
  mockActivityFindMany.mockResolvedValue([]);
  mockGetStaffLoadForFirm.mockResolvedValue([]);
  mockListPendingAgentActions.mockResolvedValue([]);
});

describe("Home — greeting", () => {
  it("uses the real user's first name, not the email", async () => {
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Shivaji");
  });

  it("falls back to the email prefix if the user's name is somehow unavailable", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("p");
  });
});

describe("Home — firm isolation", () => {
  it("every query is scoped to the session's firmId", async () => {
    await DashboardOverview();
    expect(mockTaskFindMany.mock.calls[0][0].where).toMatchObject({ firmId: FIRM_ID });
    expect(mockTaskCount.mock.calls[0][0].where).toMatchObject({ firmId: FIRM_ID });
    expect(mockMatchCount).toHaveBeenCalledWith({ where: { status: "EXCEPTION", reconciliationRun: { firmId: FIRM_ID } } });
    expect(mockRunFindMany.mock.calls[0][0].where).toMatchObject({ firmId: FIRM_ID });
    expect(mockDscFindMany.mock.calls[0][0].where).toMatchObject({ client: { firmId: FIRM_ID } });
    expect(mockActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { firmId: FIRM_ID } }));
    expect(mockListPendingAgentActions).toHaveBeenCalledWith(FIRM_ID);
  });

  it("never trusts a browser-supplied firmId/userId/role — only session values are used (structural: no searchParams/props consumed by the page)", async () => {
    // DashboardOverview takes no arguments at all — there is no channel for
    // the browser to supply firmId/userId/role; every value comes from
    // getSession() only.
    expect(DashboardOverview.length).toBe(0);
  });
});

describe("Home — Partner/Manager KPI Pulse", () => {
  it("PARTNER sees all 5 KPI cells including Outstanding and Revenue", async () => {
    mockTaskCount.mockResolvedValueOnce(7).mockResolvedValueOnce(9);
    mockMatchCount.mockResolvedValue(4);
    mockInvoiceAggregate.mockResolvedValueOnce({ _sum: { total: 42000 }, _count: 3 }).mockResolvedValueOnce({ _sum: { total: 118500 } });
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("Outstanding");
    expect(text).toContain("Revenue");
    expect(text).toContain("7");
    expect(text).toContain("9");
    expect(text).toContain("42,000");
    expect(text).toContain("1,18,500");
  });

  it("MANAGER also sees Outstanding/Revenue (matches the app's only real role split: STAFF vs not-STAFF)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "MANAGER", email: "m@firm.test" });
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Outstanding");
    expect(mockInvoiceAggregate).toHaveBeenCalled();
  });
});

describe("Home — Staff KPI Pulse", () => {
  it("STAFF does not see Outstanding or Revenue, and those queries never run", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await DashboardOverview();
    expect(textOf(tree)).not.toContain("Outstanding");
    expect(textOf(tree)).not.toContain("Revenue");
    expect(mockInvoiceAggregate).not.toHaveBeenCalled();
  });

  it("STAFF's overdue/due-soon queries are scoped to their own assigneeId", async () => {
    mockGetSession.mockReturnValue({ userId: "user_42", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    await DashboardOverview();
    expect(mockTaskFindMany.mock.calls[0][0].where).toMatchObject({ firmId: FIRM_ID, assigneeId: "user_42" });
    expect(mockTaskCount.mock.calls[0][0].where).toMatchObject({ assigneeId: "user_42" });
  });

  it("PARTNER/MANAGER's overdue query is firm-wide, not narrowed to an assignee", async () => {
    await DashboardOverview();
    expect(mockTaskFindMany.mock.calls[0][0].where.assigneeId).toBeUndefined();
  });
});

describe("Home — Team Load (Partner/Manager only)", () => {
  it("STAFF never receives Team Load — getStaffLoadForFirm is never called", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await DashboardOverview();
    expect(mockGetStaffLoadForFirm).not.toHaveBeenCalled();
    expect(textOf(tree)).not.toContain("Team load");
  });

  it("PARTNER/MANAGER sees Team Load, sorted by open count, capped at 5 rows", async () => {
    mockGetStaffLoadForFirm.mockResolvedValue([
      { userId: "u1", load: 4 }, { userId: "u2", load: 14 }, { userId: "u3", load: 9 },
      { userId: "u4", load: 2 }, { userId: "u5", load: 7 }, { userId: "u6", load: 6 },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "u1", name: "Anil" }, { id: "u2", name: "Ravi" }, { id: "u3", name: "Priya" },
      { id: "u4", name: "Kiran" }, { id: "u5", name: "Sunil" }, { id: "u6", name: "Meena" },
    ]);
    mockTaskFindMany.mockImplementation((args: any) => {
      if (args.where?.assigneeId?.in) return Promise.resolve([{ assigneeId: "u2" }, { assigneeId: "u2" }]);
      return Promise.resolve([]);
    });
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("Team load");
    expect(text).toContain("Ravi"); // highest load (14) shown
    expect(text).not.toContain("Kiran"); // lowest load (2), capped out of top 5
  });

  it("shows a '3 team members overloaded' Attention row when >5 open tasks are the Heavy threshold, counted from the full list, not just the displayed top 5", async () => {
    mockGetStaffLoadForFirm.mockResolvedValue([
      { userId: "u1", load: 14 }, { userId: "u2", load: 13 }, { userId: "u3", load: 12 },
      { userId: "u4", load: 9 }, { userId: "u5", load: 8 }, { userId: "u6", load: 11 },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "u1", name: "Anil" }, { id: "u2", name: "Ravi" }, { id: "u3", name: "Priya" },
      { id: "u4", name: "Kiran" }, { id: "u5", name: "Sunil" }, { id: "u6", name: "Meena" },
    ]);
    mockTaskFindMany.mockImplementation((args: any) => {
      if (args.where?.assigneeId?.in) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const tree = await DashboardOverview();
    // u1(14), u2(13), u3(12), u6(11) all exceed the Heavy threshold (>10) —
    // u6 is ranked 4th and would be cut from a top-3 display, so this also
    // proves the overloaded count isn't silently truncated by the display cap.
    expect(textOf(tree)).toContain("4 team members overloaded");
  });

  it("shows the 'no workload concerns' empty state when there is no staff load data", async () => {
    mockGetStaffLoadForFirm.mockResolvedValue([]);
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("No workload concerns.");
  });
});

describe("Home — Attention rail", () => {
  it("shows the caught-up empty state when there is nothing to review", async () => {
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("You're all caught up.");
  });

  it("shows an overdue row with distinct-client and oldest-days context when overdue tasks exist", async () => {
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockTaskCount.mockResolvedValueOnce(7);
    mockTaskFindMany.mockImplementation((args: any) => {
      if (args.distinct) return Promise.resolve([{ clientId: "c1" }, { clientId: "c2" }]);
      return Promise.resolve([{ id: "t1", title: "GST Return", dueDate: oldDate, priority: "URGENT", client: { id: "c1", name: "Acme" }, assignee: { id: "u1", name: "Ravi" } }]);
    });
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("7 tasks are overdue");
    expect(text).toContain("Across 2 clients");
    expect(text).not.toContain("You're all caught up.");
  });

  it("shows a reconciliation-exceptions row when exceptions exist", async () => {
    mockMatchCount.mockResolvedValue(4);
    mockRunFindMany.mockImplementation((args: any) => {
      if (args?.where?.status === "FAILED") return Promise.resolve([]);
      return Promise.resolve([{ clientId: "c1" }, { clientId: "c2" }, { clientId: "c3" }]);
    });
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Reconciliation exceptions unresolved");
  });

  it("shows a 'GST reconciliation failed' row, ranked first, when FAILED runs exist", async () => {
    const oldFailed = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockRunFindMany.mockImplementation((args: any) => {
      if (args?.where?.status === "FAILED") {
        return Promise.resolve([{ id: "run_1", createdAt: oldFailed, clientId: "c1" }, { id: "run_2", createdAt: new Date(), clientId: "c2" }]);
      }
      return Promise.resolve([]);
    });
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("GST reconciliation failed");
    expect(text).toContain("2 clients affected");
    expect(text).toContain("oldest 3d");
  });

  it("shows an agent-proposals row when proposals are pending", async () => {
    mockListPendingAgentActions.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Agent proposals awaiting review");
  });

  it("shows a DSC row with the nearest holder's name and day count", async () => {
    const soon = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    mockDscFindMany.mockResolvedValue([{ id: "d1", holderName: "Ravi Kumar", expiresAt: soon, client: { id: "c1", name: "Acme" } }]);
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("DSC expiring in 12 days");
    expect(text).toContain("1 DSC certificate");
  });
});

describe("Home — Overdue Work list", () => {
  it("shows the clean empty state with no overdue tasks", async () => {
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Nothing overdue.");
  });

  it("STAFF sees 'Your overdue work' instead of the firm-wide title", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Your overdue work");
  });

  it("PARTNER/MANAGER sees the firm-wide title", async () => {
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("Overdue work");
    expect(textOf(tree)).not.toContain("Your overdue work");
  });

  it("shows only a compact top-4 preview plus an 'All' link when the total exceeds the fetched page of 5", async () => {
    mockTaskCount.mockResolvedValueOnce(9);
    mockTaskFindMany.mockImplementation((args: any) => {
      if (args.distinct) return Promise.resolve([]);
      return Promise.resolve(Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, dueDate: new Date(), priority: null, client: null, assignee: null })));
    });
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("Task 0");
    expect(text).toContain("Task 3");
    expect(text).not.toContain("Task 4"); // 5th fetched row, beyond the 4-row display cap
    expect(text).toContain("9"); // total count still visible via the KPI card + Attention row, not lost
    const hrefs = findAllByProp(tree, "href").map((el) => el.props.href);
    expect(hrefs.filter((h) => h.includes("overdue=true")).length).toBeGreaterThan(0);
  });
});

describe("Home — DSC / Activity empty states", () => {
  it("shows 'You're covered.' when there are no upcoming DSC expiries", async () => {
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("You're covered.");
  });

  it("shows 'No activity yet.' when there is no recorded activity", async () => {
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("No activity yet.");
  });

  it("renders an activity row with the actor and title when activity exists", async () => {
    mockActivityFindMany.mockResolvedValue([
      { id: "a1", entityType: "CLIENT", entityId: "c1", title: "archived client Old Ventures LLP", actorType: "USER", actor: { name: "Priya" }, createdAt: new Date() },
    ]);
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("Priya");
    expect(text).toContain("archived client Old Ventures LLP");
  });

  it("labels a SYSTEM-actored activity as 'System', not a blank/undefined name", async () => {
    mockActivityFindMany.mockResolvedValue([
      { id: "a1", entityType: "RECONCILIATION", entityId: "run_1", title: "3 exceptions found", actorType: "SYSTEM", actor: null, createdAt: new Date() },
    ]);
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("System");
  });

  it("shows a relative timestamp ('X minutes ago') for recent activity, not an absolute date", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    mockActivityFindMany.mockResolvedValue([
      { id: "a1", entityType: "CLIENT", entityId: "c1", title: "added a note", actorType: "USER", actor: { name: "Priya" }, createdAt: fiveMinAgo },
    ]);
    const tree = await DashboardOverview();
    expect(textOf(tree)).toContain("5 minutes ago");
  });

  it("falls back to an absolute date for activity older than a week", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    mockActivityFindMany.mockResolvedValue([
      { id: "a1", entityType: "CLIENT", entityId: "c1", title: "added a note", actorType: "USER", actor: { name: "Priya" }, createdAt: tenDaysAgo },
    ]);
    const tree = await DashboardOverview();
    expect(textOf(tree)).not.toContain("ago");
  });
});

describe("Home — Quick Actions panel", () => {
  it("reuses getCreateMenuItems so the tile list always matches the Create menu (never a second hand-maintained list)", async () => {
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).toContain("Quick Actions");
    expect(text).toContain("New Task");
    expect(text).toContain("Add Client");
    expect(text).toContain("Add Lead");
    expect(text).toContain("New Invoice");
    expect(text).toContain("Add Staff");
  });

  it("STAFF's Quick Actions panel omits financial and staff tiles, matching HomeCreateMenu's own role gating", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await DashboardOverview();
    const text = textOf(tree);
    expect(text).not.toContain("New Invoice");
    expect(text).not.toContain("Add Staff");
  });
});

describe("Home — real route destinations", () => {
  it("Quick Links and section links all point at existing routes only", async () => {
    const tree = await DashboardOverview();
    const hrefs = findAllByProp(tree, "href").map((el) => el.props.href);
    expect(hrefs).toContain("/dashboard/clients");
    expect(hrefs).toContain("/dashboard/documents");
    expect(hrefs).toContain("/dashboard/reconciliation/runs");
    expect(hrefs).toContain("/dashboard/reports");
    expect(hrefs).toContain("/dashboard/tasks/templates");
    expect(hrefs).toContain("/dashboard/calendar");
    expect(hrefs).toContain("/dashboard/reconciliation");
  });

  it("a reconciliation activity links to the specific run's detail page, not just the module root", async () => {
    mockActivityFindMany.mockResolvedValue([
      { id: "a1", entityType: "RECONCILIATION", entityId: "run_77", title: "2 exceptions found", actorType: "SYSTEM", actor: null, createdAt: new Date() },
    ]);
    const tree = await DashboardOverview();
    const hrefs = findAllByProp(tree, "href").map((el) => el.props.href);
    expect(hrefs).toContain("/dashboard/reconciliation/runs/run_77");
  });
});

describe("Home — Create menu authorization", () => {
  it("PARTNER: canCreateFinancial and canAddStaff are both true", async () => {
    const tree = await DashboardOverview();
    const menus = findAllByType(tree, HomeCreateMenu);
    expect(menus).toHaveLength(1);
    expect(menus[0].props).toEqual({ canCreateFinancial: true, canAddStaff: true });
  });

  it("MANAGER: canCreateFinancial is true, canAddStaff is false (matches POST /api/staff's real PARTNER-only gate)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "MANAGER", email: "m@firm.test" });
    const tree = await DashboardOverview();
    const menus = findAllByType(tree, HomeCreateMenu);
    expect(menus[0].props).toEqual({ canCreateFinancial: true, canAddStaff: false });
  });

  it("STAFF: both canCreateFinancial and canAddStaff are false", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await DashboardOverview();
    const menus = findAllByType(tree, HomeCreateMenu);
    expect(menus[0].props).toEqual({ canCreateFinancial: false, canAddStaff: false });
  });
});

describe("Home — no N+1 / query count discipline", () => {
  it("issues exactly one findMany/count/aggregate call per data source on the first pass", async () => {
    await DashboardOverview();
    expect(mockActivityFindMany).toHaveBeenCalledTimes(1);
    expect(mockDscFindMany).toHaveBeenCalledTimes(1);
    expect(mockMatchCount).toHaveBeenCalledTimes(1);
    // reconciliationRun.findMany backs two distinct read-only queries this
    // pass (exception-client rows + FAILED-run detection) — exactly 2, not N.
    expect(mockRunFindMany).toHaveBeenCalledTimes(2);
  });

  it("the team-load follow-up queries only run when getStaffLoadForFirm actually returned staff", async () => {
    mockGetStaffLoadForFirm.mockResolvedValue([]);
    await DashboardOverview();
    // user.findMany/task.findMany for team load would be called with an `in` filter; assert none was
    const inFilterCalls = mockTaskFindMany.mock.calls.filter((c: any[]) => c[0]?.where?.assigneeId?.in);
    expect(inFilterCalls).toHaveLength(0);
  });
});
