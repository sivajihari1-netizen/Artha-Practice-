import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockClientFindFirst = vi.fn();
const mockComplianceRuleFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: (...a: unknown[]) => mockClientFindFirst(...a) },
    complianceRule: { findMany: (...a: unknown[]) => mockComplianceRuleFindMany(...a) },
  },
}));

const mockGetClientUnifiedActivityTimeline = vi.fn();
vi.mock("@/lib/activity", () => ({
  getClientUnifiedActivityTimeline: (...a: unknown[]) => mockGetClientUnifiedActivityTimeline(...a),
}));

import ClientDetailPage from "./page";
import ClientArchiveControl from "@/components/ClientArchiveControl";

function findAllByProp(node: unknown, propName: string, propValue: unknown, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByProp(n, propName, propValue, out);
    return out;
  }
  const el = node as any;
  if (el.props?.[propName] === propValue) out.push(el);
  if (el.props?.children !== undefined) findAllByProp(el.props.children, propName, propValue, out);
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

const CLIENT_FIXTURE = {
  id: "client_1",
  name: "Acme Pvt Ltd",
  type: "COMPANY",
  pan: "ABCDE1234F",
  gstin: null,
  turnover: null,
  active: true,
  contacts: [],
  credentials: [],
  dscRecords: [],
  tasks: [
    {
      id: "task_1",
      title: "GSTR-3B — June",
      status: "TODO",
      priority: "HIGH",
      dueDate: null,
      _count: { documents: 0 },
      documentRequests: [],
    },
  ],
  documents: [],
  gstReconciliations: [],
  documentRequests: [],
  gstins: [],
  invoices: [],
  quotations: [],
  reconciliationRuns: [],
  _count: { invoices: 0, quotations: 0, reconciliationRuns: 0 },
  convertedFromLeads: [],
  notificationLogs: [],
};

describe("Client 360 — task list entry point (Task 360 Phase 2, test J)", () => {
  it("J. each task in the flat Tasks list links to its Task 360 page", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "MANAGER", email: "m@firm.test" });
    mockClientFindFirst.mockResolvedValue(CLIENT_FIXTURE);
    mockComplianceRuleFindMany.mockResolvedValue([]);
    mockGetClientUnifiedActivityTimeline.mockResolvedValue({ ok: true, activities: [], nextCursor: null });

    const tree = await ClientDetailPage({ params: { id: "client_1" } });
    const links = findAllByProp(tree, "href", "/dashboard/tasks/task_1");
    expect(links.length).toBeGreaterThan(0);
  });
});

describe("Client 360 — unified Activity feed (P1 batch)", () => {
  it("fetches the merged activity timeline scoped to this client's own firm and id, not any browser-supplied value", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "MANAGER", email: "m@firm.test" });
    mockClientFindFirst.mockResolvedValue(CLIENT_FIXTURE);
    mockComplianceRuleFindMany.mockResolvedValue([]);
    mockGetClientUnifiedActivityTimeline.mockResolvedValue({ ok: true, activities: [], nextCursor: null });

    await ClientDetailPage({ params: { id: "client_1" } });

    expect(mockGetClientUnifiedActivityTimeline).toHaveBeenCalledWith({ firmId: "firm_1", clientId: "client_1" });
  });
});

describe("Client 360 — archive control (Batch C)", () => {
  it("a PARTNER/MANAGER viewer sees the archive control, receiving the client's real active state", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "MANAGER", email: "m@firm.test" });
    mockClientFindFirst.mockResolvedValue(CLIENT_FIXTURE);
    mockComplianceRuleFindMany.mockResolvedValue([]);
    mockGetClientUnifiedActivityTimeline.mockResolvedValue({ ok: true, activities: [], nextCursor: null });

    const tree = await ClientDetailPage({ params: { id: "client_1" } });
    const controls = findAllByType(tree, ClientArchiveControl);
    expect(controls).toHaveLength(1);
    expect(controls[0].props).toEqual({ clientId: "client_1", active: true });
  });

  it("a STAFF viewer never receives the archive control — UI-only restriction, backend is unaffected", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "STAFF", email: "s@firm.test" });
    mockClientFindFirst.mockResolvedValue(CLIENT_FIXTURE);
    mockComplianceRuleFindMany.mockResolvedValue([]);
    mockGetClientUnifiedActivityTimeline.mockResolvedValue({ ok: true, activities: [], nextCursor: null });

    const tree = await ClientDetailPage({ params: { id: "client_1" } });
    expect(findAllByType(tree, ClientArchiveControl)).toHaveLength(0);
  });

  it("an archived client's own detail page still renders in full — archiving never hides historical data from itself", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockClientFindFirst.mockResolvedValue({ ...CLIENT_FIXTURE, active: false });
    mockComplianceRuleFindMany.mockResolvedValue([]);
    mockGetClientUnifiedActivityTimeline.mockResolvedValue({ ok: true, activities: [], nextCursor: null });

    const tree = await ClientDetailPage({ params: { id: "client_1" } });
    const controls = findAllByType(tree, ClientArchiveControl);
    expect(controls[0].props.active).toBe(false);
    // The lookup itself never filters by active — an archived client's page must stay reachable.
    expect(mockClientFindFirst.mock.calls[0][0].where).toEqual({ id: "client_1", firmId: "firm_1" });
  });
});
