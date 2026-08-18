import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTemplateFindMany = vi.fn();
const mockClientFindMany = vi.fn();
const mockTaskFindMany = vi.fn();
const mockTaskCreateManyAndReturn = vi.fn();
const mockRuleFindMany = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskTemplate: { findMany: (...a: unknown[]) => mockTemplateFindMany(...a) },
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
    task: {
      findMany: (...a: unknown[]) => mockTaskFindMany(...a),
      createManyAndReturn: (...a: unknown[]) => mockTaskCreateManyAndReturn(...a),
    },
    complianceRule: { findMany: (...a: unknown[]) => mockRuleFindMany(...a) },
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
  },
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { TASK_CREATED: "TASK_CREATED" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { generateRecurringTasksForFirm, generateComplianceRuleTasks } from "./recurringTasks";

const NOW = new Date("2026-06-15T00:00:00.000Z"); // MONTHLY periodKey => "2026-06"
const FIRM_ID = "firm_1";

function template(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "tmpl_1", firmId: FIRM_ID, title: "GSTR-3B", returnType: "GST", recurrence: "MONTHLY", checklist: null, active: true, ...overrides };
}
function client(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "client_1", firmId: FIRM_ID, name: "Acme Pvt Ltd", type: "COMPANY", gstin: "27AAAPL1234C1ZV", active: true, ...overrides };
}
/** Shapes a fake createManyAndReturn row for the template-driven generator. */
function createdRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "task_1", clientId: "client_1", sourceTemplateId: "tmpl_1", periodKey: "2026-06", title: "GSTR-3B — Acme Pvt Ltd", ...overrides };
}
/** Shapes a fake createManyAndReturn row for the compliance-rule generator (has its own firmId per row). */
function createdRuleRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "task_1", firmId: FIRM_ID, clientId: "client_1", complianceRuleId: "rule_1", periodKey: "2026-06", title: "GSTR-3B — Acme Pvt Ltd", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTaskCreateManyAndReturn.mockResolvedValue([]);
});

describe("generateRecurringTasksForFirm — pre-check idempotency", () => {
  it("returns immediately with no DB writes when there are no eligible candidates", async () => {
    mockTemplateFindMany.mockResolvedValue([]);
    mockClientFindMany.mockResolvedValue([]);
    const result = await generateRecurringTasksForFirm(FIRM_ID, NOW);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockTaskFindMany).not.toHaveBeenCalled(); // no pre-check query when there's nothing to check
    expect(mockTaskCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("first run (cold): creates every eligible candidate via one createManyAndReturn call", async () => {
    mockTemplateFindMany.mockResolvedValue([template()]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([]); // nothing exists yet
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRow()]);

    const result = await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(mockTaskCreateManyAndReturn).toHaveBeenCalledTimes(1);
    const [{ data, skipDuplicates }] = mockTaskCreateManyAndReturn.mock.calls[0];
    expect(skipDuplicates).toBe(true);
    expect(data).toEqual([
      expect.objectContaining({
        firmId: FIRM_ID,
        clientId: "client_1",
        sourceTemplateId: "tmpl_1",
        periodKey: "2026-06",
        title: "GSTR-3B — Acme Pvt Ltd",
        returnType: "GST",
      }),
    ]);
  });

  it("warm re-run (idempotent): pre-check finds everything already exists — zero writes, zero DB write calls", async () => {
    mockTemplateFindMany.mockResolvedValue([template()]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([{ sourceTemplateId: "tmpl_1", clientId: "client_1", periodKey: "2026-06" }]);

    const result = await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(mockTaskCreateManyAndReturn).not.toHaveBeenCalled(); // the whole point of the pre-check
  });

  it("partial warm run: only genuinely-new candidates are sent to createManyAndReturn, not the ones that already exist", async () => {
    mockTemplateFindMany.mockResolvedValue([template({ id: "tmpl_1" }), template({ id: "tmpl_2", title: "GSTR-1" })]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([{ sourceTemplateId: "tmpl_1", clientId: "client_1", periodKey: "2026-06" }]);
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRow({ sourceTemplateId: "tmpl_2" })]);

    const result = await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(result).toEqual({ created: 1, skipped: 1 });
    const [{ data }] = mockTaskCreateManyAndReturn.mock.calls[0];
    expect(data).toHaveLength(1);
    expect(data[0].sourceTemplateId).toBe("tmpl_2");
  });

  it("skips a client ineligible for a GST template (no GSTIN) without it ever reaching the pre-check or write", async () => {
    mockTemplateFindMany.mockResolvedValue([template({ returnType: "GST" })]);
    mockClientFindMany.mockResolvedValue([client({ gstin: null })]);

    const result = await generateRecurringTasksForFirm(FIRM_ID, NOW);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("Batch D regression: the template query itself filters on active:true, so a deactivated template can never generate a new task", async () => {
    mockTemplateFindMany.mockResolvedValue([]);
    mockClientFindMany.mockResolvedValue([]);

    await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(mockTemplateFindMany).toHaveBeenCalledWith({ where: { firmId: FIRM_ID, active: true } });
  });

  it("the pre-check query is bounded to this firm's own template ids (not every task in the DB)", async () => {
    mockTemplateFindMany.mockResolvedValue([template({ id: "tmpl_1" })]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([]);
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRow()]);

    await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(mockTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, sourceTemplateId: { in: ["tmpl_1"] } } })
    );
  });

  it("uses createManyAndReturn's actual returned rows for created/skipped, not just the pre-check's guess (covers the skipDuplicates safety-net race case)", async () => {
    mockTemplateFindMany.mockResolvedValue([template({ id: "tmpl_1" }), template({ id: "tmpl_2" })]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([]); // pre-check says both are new
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRow()]); // but the DB only actually inserted 1 (a race skipped the other)

    const result = await generateRecurringTasksForFirm(FIRM_ID, NOW);
    expect(result).toEqual({ created: 1, skipped: 1 });
  });
});

describe("generateRecurringTasksForFirm — P0.6: TASK_CREATED activity", () => {
  it("records TASK_CREATED with actorType SYSTEM and useful metadata for each genuinely-created task", async () => {
    mockTemplateFindMany.mockResolvedValue([template()]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([]);
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRow()]);

    await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(mockRecordActivity).toHaveBeenCalledWith({
      firmId: FIRM_ID,
      entityType: "TASK",
      entityId: "task_1",
      eventType: "TASK_CREATED",
      title: "Task created: GSTR-3B — Acme Pvt Ltd",
      actorType: "SYSTEM",
      metadata: { taskId: "task_1", clientId: "client_1", sourceTemplateId: "tmpl_1", periodKey: "2026-06" },
    });
  });

  it("records one activity per created task when several are created in the same run", async () => {
    mockTemplateFindMany.mockResolvedValue([template({ id: "tmpl_1" }), template({ id: "tmpl_2" })]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([]);
    mockTaskCreateManyAndReturn.mockResolvedValue([
      createdRow({ id: "task_1", sourceTemplateId: "tmpl_1" }),
      createdRow({ id: "task_2", sourceTemplateId: "tmpl_2" }),
    ]);

    await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(mockRecordActivity).toHaveBeenCalledTimes(2);
  });

  it("records no activity when the pre-check finds everything already exists (no-op run)", async () => {
    mockTemplateFindMany.mockResolvedValue([template()]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([{ sourceTemplateId: "tmpl_1", clientId: "client_1", periodKey: "2026-06" }]);

    await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("records no activity for a candidate skipped by the DB's own skipDuplicates safety net (race case)", async () => {
    mockTemplateFindMany.mockResolvedValue([template({ id: "tmpl_1" }), template({ id: "tmpl_2" })]);
    mockClientFindMany.mockResolvedValue([client()]);
    mockTaskFindMany.mockResolvedValue([]); // pre-check says both are new
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRow({ sourceTemplateId: "tmpl_1" })]); // only 1 actually inserted

    await generateRecurringTasksForFirm(FIRM_ID, NOW);

    expect(mockRecordActivity).toHaveBeenCalledTimes(1);
  });
});

describe("generateComplianceRuleTasks — pre-check idempotency + assignee balancing", () => {
  const rule = {
    id: "rule_1",
    ruleCode: "GSTR3B_MONTHLY",
    title: "GSTR-3B",
    returnType: "GST",
    recurrence: "MONTHLY",
    appliesToGstin: false,
    conditions: {},
    dueDateOffsetDays: null,
    overrideDueDate: null,
    overrideAppliesToPeriod: null,
    active: true,
  };

  it("returns early with no queries when there are no clients", async () => {
    const result = await generateComplianceRuleTasks([], NOW);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockRuleFindMany).not.toHaveBeenCalled();
  });

  it("returns early when there are no active rules", async () => {
    mockRuleFindMany.mockResolvedValue([]);
    const result = await generateComplianceRuleTasks([{ ...client(), gstins: [] }] as any, NOW);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("cold run creates via createManyAndReturn, resolving an assignee from the least-loaded staff member", async () => {
    mockRuleFindMany.mockResolvedValue([rule]);
    mockTaskFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([
      { id: "staff_busy", _count: { assignedTasks: 5 } },
      { id: "staff_free", _count: { assignedTasks: 0 } },
    ]);
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRuleRow()]);

    const result = await generateComplianceRuleTasks([{ ...client(), gstins: [] }] as any, NOW, 60);

    expect(result).toEqual({ created: 1, skipped: 0 });
    const [{ data }] = mockTaskCreateManyAndReturn.mock.calls[0];
    expect(data[0].assigneeId).toBe("staff_free");
    expect(data[0].complianceRuleId).toBe("rule_1");
  });

  it("warm re-run: pre-check finds the task already exists — zero writes, staff load never even queried", async () => {
    mockRuleFindMany.mockResolvedValue([rule]);
    mockTaskFindMany.mockResolvedValue([{ complianceRuleId: "rule_1", clientId: "client_1", periodKey: "2026-06" }]);

    const result = await generateComplianceRuleTasks([{ ...client(), gstins: [] }] as any, NOW, 60);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(mockTaskCreateManyAndReturn).not.toHaveBeenCalled();
    expect(mockUserFindMany).not.toHaveBeenCalled(); // assignee resolution never runs for candidates that already exist
  });

  it("balances assignment across multiple new candidates in the same run", async () => {
    mockRuleFindMany.mockResolvedValue([rule]);
    mockTaskFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([
      { id: "staff_a", _count: { assignedTasks: 0 } },
      { id: "staff_b", _count: { assignedTasks: 0 } },
    ]);
    mockTaskCreateManyAndReturn.mockResolvedValue([
      createdRuleRow({ id: "task_1", clientId: "client_1" }),
      createdRuleRow({ id: "task_2", clientId: "client_2" }),
    ]);

    const clients = [
      { ...client({ id: "client_1" }), gstins: [] },
      { ...client({ id: "client_2" }), gstins: [] },
    ] as any;
    await generateComplianceRuleTasks(clients, NOW, 60);

    const [{ data }] = mockTaskCreateManyAndReturn.mock.calls[0];
    expect(data).toHaveLength(2);
    // First pick goes to whichever of the two equal-load staff sorts first;
    // the second pick must go to the *other* one, since the first pick's
    // in-memory load was incremented — this is the load-balancing behavior
    // being preserved unchanged from before the fix.
    expect(data[0].assigneeId).not.toBe(data[1].assigneeId);
  });
});

describe("generateComplianceRuleTasks — P0.6: TASK_CREATED activity", () => {
  const rule = {
    id: "rule_1", ruleCode: "GSTR3B_MONTHLY", title: "GSTR-3B", returnType: "GST", recurrence: "MONTHLY",
    appliesToGstin: false, conditions: {}, dueDateOffsetDays: null, overrideDueDate: null, overrideAppliesToPeriod: null, active: true,
  };

  it("records TASK_CREATED with actorType SYSTEM, using each row's own firmId, and useful metadata", async () => {
    mockRuleFindMany.mockResolvedValue([rule]);
    mockTaskFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);
    mockTaskCreateManyAndReturn.mockResolvedValue([createdRuleRow()]);

    await generateComplianceRuleTasks([{ ...client(), gstins: [] }] as any, NOW, 60);

    expect(mockRecordActivity).toHaveBeenCalledWith({
      firmId: FIRM_ID,
      entityType: "TASK",
      entityId: "task_1",
      eventType: "TASK_CREATED",
      title: "Task created: GSTR-3B — Acme Pvt Ltd",
      actorType: "SYSTEM",
      metadata: { taskId: "task_1", clientId: "client_1", complianceRuleId: "rule_1", periodKey: "2026-06" },
    });
  });

  it("records no activity on a warm no-op run", async () => {
    mockRuleFindMany.mockResolvedValue([rule]);
    mockTaskFindMany.mockResolvedValue([{ complianceRuleId: "rule_1", clientId: "client_1", periodKey: "2026-06" }]);

    await generateComplianceRuleTasks([{ ...client(), gstins: [] }] as any, NOW, 60);

    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
