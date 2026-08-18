import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockTaskFindMany = vi.fn();
const mockClientFindMany = vi.fn();
const mockUserFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findMany: (...a: unknown[]) => mockTaskFindMany(...a) },
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
  },
}));

vi.mock("@/lib/taskWorkflow", () => ({
  ensureFirmTaskWorkflow: vi.fn().mockResolvedValue({ statusOptions: [], categoryOptions: [] }),
}));

import TasksPage from "./page";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
  mockTaskFindMany.mockResolvedValue([]);
  mockClientFindMany.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([]);
});

describe("Tasks page — Batch B item 5 dependency: minimal 'Overdue only' filter", () => {
  it("without ?overdue=true, the query has no dueDate/status narrowing beyond the existing view filter", async () => {
    await TasksPage({ searchParams: { view: "all" } });
    const call = mockTaskFindMany.mock.calls[0][0] as any;
    expect(call.where).toEqual({ firmId: "firm_1" });
  });

  it("?overdue=true narrows the query to not-DONE tasks past their due date", async () => {
    await TasksPage({ searchParams: { view: "all", overdue: "true" } });
    const call = mockTaskFindMany.mock.calls[0][0] as any;
    expect(call.where).toEqual(
      expect.objectContaining({ firmId: "firm_1", status: { not: "DONE" }, dueDate: { lt: expect.any(Date) } })
    );
  });

  it("the 'Overdue only' toggle link points at the filtered URL when off, and back to the plain view when on", async () => {
    const treeOff = await TasksPage({ searchParams: { view: "all" } });
    const offLinks = findAllByProp(treeOff, "href").map((el) => el.props.href);
    expect(offLinks).toContain("/dashboard/tasks?view=all&overdue=true");

    const treeOn = await TasksPage({ searchParams: { view: "all", overdue: "true" } });
    const onLinks = findAllByProp(treeOn, "href").map((el) => el.props.href);
    expect(onLinks).toContain("/dashboard/tasks?view=all");
  });

  it("overdue filtering still respects the existing 'My Work' scoping (both conditions combine, neither replaces the other)", async () => {
    await TasksPage({ searchParams: { view: "mine", overdue: "true" } });
    const call = mockTaskFindMany.mock.calls[0][0] as any;
    expect(call.where).toEqual(
      expect.objectContaining({ firmId: "firm_1", assigneeId: "user_1", status: { not: "DONE" }, dueDate: { lt: expect.any(Date) } })
    );
  });
});
