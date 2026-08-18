import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const mockTaskFindFirst = vi.fn();
const mockTaskFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockStatusOptionFindMany = vi.fn();
const mockCategoryOptionFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findFirst: (...a: unknown[]) => mockTaskFindFirst(...a),
      findMany: (...a: unknown[]) => mockTaskFindMany(...a),
    },
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    taskStatusOption: {
      findMany: (...a: unknown[]) => mockStatusOptionFindMany(...a),
      createMany: vi.fn(),
    },
    taskCategoryOption: {
      findMany: (...a: unknown[]) => mockCategoryOptionFindMany(...a),
      createMany: vi.fn(),
    },
  },
}));

const mockGetEntityActivityTimeline = vi.fn();
vi.mock("@/lib/activity", () => ({
  getEntityActivityTimeline: (...a: unknown[]) => mockGetEntityActivityTimeline(...a),
}));

import TaskDetailPage from "./page";
import TaskActionsBar from "@/components/TaskActionsBar";
import TaskDocumentsSection from "@/components/TaskDocumentsSection";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "MANAGER" as const, email: "m@firm.test" };

const STATUS_OPTIONS = [
  { id: "opt_todo", firmId: "firm_1", name: "To Do", key: "TODO", systemKey: "TODO", isActive: true, sortOrder: 1 },
  { id: "opt_done", firmId: "firm_1", name: "Done", key: "DONE", systemKey: "DONE", isActive: true, sortOrder: 4 },
];
const CATEGORY_OPTIONS = [{ id: "cat_gst", firmId: "firm_1", name: "GST", key: "GST", systemKey: "GST", isActive: true, sortOrder: 1 }];

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task_1",
    firmId: "firm_1",
    clientId: "client_1",
    title: "GSTR-3B — June",
    description: null,
    returnType: "GST",
    status: "TODO",
    priority: "HIGH",
    statusOptionId: "opt_todo",
    statusOption: { id: "opt_todo", name: "To Do", systemKey: "TODO" },
    categoryOptionId: "cat_gst",
    categoryOption: { id: "cat_gst", name: "GST" },
    dueDate: new Date("2026-07-20"),
    assigneeId: "user_2",
    assignee: { id: "user_2", name: "Priya Sharma" },
    createdById: "user_1",
    createdBy: { id: "user_1", name: "Manager One" },
    checklist: null,
    sourceTemplateId: null,
    sourceTemplate: null,
    complianceRuleId: "rule_1",
    complianceRule: { id: "rule_1", ruleCode: "GSTR3B_MONTHLY", title: "GSTR-3B Monthly Filing", recurrence: "MONTHLY" },
    clientGstinId: null,
    periodKey: "2026-06",
    lastReminderSentAt: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    client: {
      id: "client_1",
      name: "Acme Pvt Ltd",
      type: "COMPANY",
      pan: "ABCDE1234F",
      gstin: "29ABCDE1234F1Z5",
      contacts: [{ name: "Ramesh", phone: "9999999999", email: "ramesh@acme.test" }],
    },
    documents: [{ id: "doc_1", fileName: "bank-statement.pdf", category: "Bank Statement", sizeBytes: 20480 }],
    documentRequests: [
      {
        id: "req_1",
        status: "PARTIAL",
        items: [
          { id: "item_1", label: "Bank Statement", fulfilled: true },
          { id: "item_2", label: "Sales Register", fulfilled: false },
        ],
      },
    ],
    reconciliationMatches: [],
    ...overrides,
  };
}

function findByType(node: unknown, type: unknown): any {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findByType(n, type);
      if (found) return found;
    }
    return null;
  }
  const el = node as any;
  if (el.type === type) return el;
  if (el.props?.children !== undefined) return findByType(el.props.children, type);
  return null;
}

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue(SESSION);
  mockStatusOptionFindMany.mockResolvedValue(STATUS_OPTIONS);
  mockCategoryOptionFindMany.mockResolvedValue(CATEGORY_OPTIONS);
  mockUserFindMany.mockResolvedValue([{ id: "user_2", name: "Priya Sharma" }]);
  mockTaskFindMany.mockResolvedValue([]); // the assignee-workload sub-query
  mockGetEntityActivityTimeline.mockResolvedValue({ ok: true, activities: [], nextCursor: null });
});

// H. "Unauthorized mutation remains blocked" is NOT re-tested here — Task
// 360 reuses PATCH /api/tasks/[id] verbatim (no new mutation route), and
// that route's reassignment authorization already has full coverage in
// src/app/api/tasks/[id]/route.test.ts (scenarios E/F/G from the P1 batch).
describe("Task 360 — /dashboard/tasks/[id]", () => {
  it("A. an existing, same-firm task renders", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    const tree = await TaskDetailPage({ params: { id: "task_1" } });
    expect(textOf(tree)).toContain("GSTR-3B — June");
  });

  it("B. a nonexistent task 404s", async () => {
    mockTaskFindFirst.mockResolvedValue(null);
    await expect(TaskDetailPage({ params: { id: "missing" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("C. the task lookup is scoped to the session's own firmId — never a browser-supplied one", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    await TaskDetailPage({ params: { id: "task_1" } });
    expect(mockTaskFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task_1", firmId: "firm_1" } }));
  });

  it("C. a task belonging to another firm 404s exactly like a nonexistent one (Prisma's own where-clause enforces this — findFirst returns null)", async () => {
    mockTaskFindFirst.mockResolvedValue(null);
    await expect(TaskDetailPage({ params: { id: "other_firms_task" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("D. every relation comes from the one firm-scoped task query, not a second unscoped lookup", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    await TaskDetailPage({ params: { id: "task_1" } });
    expect(mockTaskFindFirst).toHaveBeenCalledTimes(1);
    const call = mockTaskFindFirst.mock.calls[0][0] as any;
    expect(call.include).toEqual(
      expect.objectContaining({
        client: expect.anything(),
        assignee: expect.anything(),
        documents: expect.anything(),
        documentRequests: expect.anything(),
      })
    );
  });

  it("E. documents rendered are exactly what the task query returned — no separate client-wide document fetch", async () => {
    const task = baseTask();
    mockTaskFindFirst.mockResolvedValue(task);
    const tree = await TaskDetailPage({ params: { id: "task_1" } });
    const docsEl = findByType(tree, TaskDocumentsSection);
    expect(docsEl.props.documents).toBe(task.documents);
  });

  it("F. document requests rendered are exactly what the task query returned", async () => {
    const task = baseTask();
    mockTaskFindFirst.mockResolvedValue(task);
    const tree = await TaskDetailPage({ params: { id: "task_1" } });
    const docsEl = findByType(tree, TaskDocumentsSection);
    expect(docsEl.props.documentRequests).toBe(task.documentRequests);
  });

  it("G. the activity timeline is fetched scoped to entityType=TASK, entityId=this task", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    await TaskDetailPage({ params: { id: "task_1" } });
    expect(mockGetEntityActivityTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ firmId: "firm_1", entityType: "TASK", entityId: "task_1" })
    );
  });

  it("shows provenance from the linked compliance rule and formats the period", async () => {
    mockTaskFindFirst.mockResolvedValue(baseTask());
    const tree = await TaskDetailPage({ params: { id: "task_1" } });
    const text = textOf(tree);
    expect(text).toContain("GSTR-3B Monthly Filing");
    expect(text).toContain("June 2026");
  });

  it("falls back to 'Created manually' provenance when no rule or template is linked", async () => {
    mockTaskFindFirst.mockResolvedValue(
      baseTask({ complianceRuleId: null, complianceRule: null, sourceTemplateId: null, sourceTemplate: null })
    );
    const tree = await TaskDetailPage({ params: { id: "task_1" } });
    expect(textOf(tree)).toContain("Created manually");
  });

  it("STAFF cannot reassign — the quick-actions bar receives canReassign=false", async () => {
    mockGetSession.mockReturnValue({ ...SESSION, role: "STAFF" });
    mockTaskFindFirst.mockResolvedValue(baseTask());
    const tree = await TaskDetailPage({ params: { id: "task_1" } });
    const bar = findByType(tree, TaskActionsBar);
    expect(bar.props.canReassign).toBe(false);
  });

  describe("Batch B item 3 — ReconciliationMatch -> Task provenance (reverse of the Exceptions queue's own link)", () => {
    it("shows reconciliation-exception provenance and links to the Exceptions queue when a match exists and there's no rule/template", async () => {
      mockTaskFindFirst.mockResolvedValue(
        baseTask({
          complianceRuleId: null,
          complianceRule: null,
          sourceTemplateId: null,
          sourceTemplate: null,
          reconciliationMatches: [{ id: "match_1", exceptionReason: "AMOUNT_MISMATCH", riskScore: 75, status: "EXCEPTION" }],
        })
      );
      const tree = await TaskDetailPage({ params: { id: "task_1" } });
      const text = textOf(tree);
      expect(text).toContain("Amount mismatch");
      expect(text).toContain("Risk 75");
      const links = findAllByHref(tree, "/dashboard/reconciliation");
      expect(links.length).toBeGreaterThan(0);
    });

    it("a linked compliance rule still takes provenance priority over a reconciliation match", async () => {
      mockTaskFindFirst.mockResolvedValue(
        baseTask({ reconciliationMatches: [{ id: "match_1", exceptionReason: "AMOUNT_MISMATCH", riskScore: 75, status: "EXCEPTION" }] })
      );
      const tree = await TaskDetailPage({ params: { id: "task_1" } });
      expect(textOf(tree)).toContain("GSTR-3B Monthly Filing");
    });

    it("no Reconciliation Exceptions link renders when the task has no linked match", async () => {
      mockTaskFindFirst.mockResolvedValue(baseTask({ reconciliationMatches: [] }));
      const tree = await TaskDetailPage({ params: { id: "task_1" } });
      expect(findAllByHref(tree, "/dashboard/reconciliation")).toHaveLength(0);
    });
  });
});

function findAllByHref(node: unknown, href: string, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByHref(n, href, out);
    return out;
  }
  const el = node as any;
  if (el.props?.href === href) out.push(el);
  if (el.props?.children !== undefined) findAllByHref(el.props.children, href, out);
  return out;
}
