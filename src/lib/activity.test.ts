import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockClientFindFirst = vi.fn();
const mockUserFindFirst = vi.fn();
const mockTaskFindFirst = vi.fn();
const mockInvoiceFindMany = vi.fn();
const mockQuotationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    client: { findFirst: (...args: unknown[]) => mockClientFindFirst(...args) },
    user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
    task: { findFirst: (...args: unknown[]) => mockTaskFindFirst(...args) },
    invoice: { findMany: (...args: unknown[]) => mockInvoiceFindMany(...args) },
    quotation: { findMany: (...args: unknown[]) => mockQuotationFindMany(...args) },
  },
}));

import { ActivityEvent, getClientUnifiedActivityTimeline, getEntityActivityTimeline, recordActivity } from "./activity";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordActivity — standalone (best-effort, matches logAudit's convention)", () => {
  it("creates an activity with the given fields", async () => {
    mockCreate.mockResolvedValue({ id: "act_1" });
    await recordActivity({
      firmId: "firm_1",
      entityType: "CLIENT",
      entityId: "client_1",
      eventType: ActivityEvent.CLIENT_CREATED,
      title: "Client created",
      actorId: "user_1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firmId: "firm_1",
          entityType: "CLIENT",
          entityId: "client_1",
          eventType: "CLIENT_CREATED",
          title: "Client created",
          actorType: "USER",
          actorId: "user_1",
        }),
      })
    );
  });

  it("defaults actorType to USER when not specified", async () => {
    mockCreate.mockResolvedValue({ id: "act_1" });
    await recordActivity({ firmId: "firm_1", entityType: "TASK", entityId: "task_1", eventType: ActivityEvent.TASK_CREATED, title: "Task created" });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorType: "USER" }) }));
  });

  it("swallows a write failure rather than throwing, when not inside a caller-supplied transaction", async () => {
    mockCreate.mockRejectedValue(new Error("db down"));
    await expect(
      recordActivity({ firmId: "firm_1", entityType: "TASK", entityId: "task_1", eventType: ActivityEvent.TASK_CREATED, title: "Task created" })
    ).resolves.toBeUndefined();
  });

  it("stores structured metadata for later querying, not as the only record of relational info", async () => {
    mockCreate.mockResolvedValue({ id: "act_1" });
    await recordActivity({
      firmId: "firm_1",
      entityType: "TASK",
      entityId: "task_1",
      eventType: ActivityEvent.TASK_STATUS_CHANGED,
      title: "Status changed: To Do → In Review",
      metadata: { fromSystemKey: "TODO", toSystemKey: "REVIEW" },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadata: { fromSystemKey: "TODO", toSystemKey: "REVIEW" } }) })
    );
  });
});

describe("recordActivity — inside an existing transaction", () => {
  it("uses the passed tx client instead of the default prisma client", async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: "act_1" });
    const tx = { activity: { create: txCreate } } as never;
    await recordActivity({ db: tx, firmId: "firm_1", entityType: "LEAD", entityId: "lead_1", eventType: ActivityEvent.LEAD_CONVERTED, title: "Lead converted" });
    expect(txCreate).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("lets a write failure propagate so the caller's transaction rolls back", async () => {
    const tx = { activity: { create: vi.fn().mockRejectedValue(new Error("constraint violation")) } } as never;
    await expect(
      recordActivity({ db: tx, firmId: "firm_1", entityType: "LEAD", entityId: "lead_1", eventType: ActivityEvent.LEAD_CONVERTED, title: "Lead converted" })
    ).rejects.toThrow("constraint violation");
  });
});

describe("getEntityActivityTimeline — firm isolation via entity ownership", () => {
  it("returns ok:false for an entity that doesn't belong to the requesting firm", async () => {
    mockClientFindFirst.mockResolvedValue(null); // not found under this firmId — either wrong firm or doesn't exist
    const result = await getEntityActivityTimeline({ firmId: "firm_1", entityType: "CLIENT", entityId: "client_from_other_firm" });
    expect(result.ok).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns activities scoped to firmId + entity once ownership is confirmed", async () => {
    mockTaskFindFirst.mockResolvedValue({ id: "task_1" });
    mockFindMany.mockResolvedValue([
      { id: "act_2", eventType: "TASK_STATUS_CHANGED", title: "Status changed", description: null, metadata: null, actorType: "USER", actor: { id: "u1", name: "Ravi" }, createdAt: new Date() },
      { id: "act_1", eventType: "TASK_CREATED", title: "Task created", description: null, metadata: null, actorType: "USER", actor: { id: "u1", name: "Ravi" }, createdAt: new Date() },
    ]);
    const result = await getEntityActivityTimeline({ firmId: "firm_1", entityType: "TASK", entityId: "task_1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.activities).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    }
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: "firm_1", entityType: "TASK", entityId: "task_1" } })
    );
  });

  it("paginates: returns nextCursor and trims to the requested page size when more rows exist", async () => {
    mockTaskFindFirst.mockResolvedValue({ id: "task_1" });
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `act_${i}`,
      eventType: "TASK_UPDATED",
      title: "Task updated",
      description: null,
      metadata: null,
      actorType: "USER" as const,
      actor: null,
      createdAt: new Date(),
    }));
    mockFindMany.mockResolvedValue(rows); // limit+1 returned to signal "more exist"
    const result = await getEntityActivityTimeline({ firmId: "firm_1", entityType: "TASK", entityId: "task_1", limit: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.activities).toHaveLength(2);
      expect(result.nextCursor).toBe("act_1");
    }
  });

  it("clamps an out-of-range limit to the max page size", async () => {
    mockTaskFindFirst.mockResolvedValue({ id: "task_1" });
    mockFindMany.mockResolvedValue([]);
    await getEntityActivityTimeline({ firmId: "firm_1", entityType: "TASK", entityId: "task_1", limit: 9999 });
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 })); // MAX_PAGE_SIZE (50) + 1
  });
});

function activityRow(overrides: Record<string, unknown>) {
  return {
    id: "act_x",
    eventType: "CLIENT_UPDATED",
    title: "Client updated",
    description: null,
    metadata: null,
    actorType: "USER" as const,
    actor: { id: "u1", name: "Ravi" },
    createdAt: new Date(),
    entityType: "CLIENT" as const,
    entityId: "client_1",
    ...overrides,
  };
}

describe("getClientUnifiedActivityTimeline — Client 360 Phase 1: unified activity feed", () => {
  beforeEach(() => {
    mockInvoiceFindMany.mockResolvedValue([]);
    mockQuotationFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
  });

  it("A. CLIENT-entity activity appears in the merged result", async () => {
    const clientRow = activityRow({ id: "act_client", entityType: "CLIENT", entityId: "client_1", eventType: "CLIENT_UPDATED" });
    mockFindMany.mockResolvedValue([clientRow]);
    const result = await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(result.activities.map((a) => a.id)).toContain("act_client");
  });

  it("B. activity for an invoice belonging to this client appears", async () => {
    mockInvoiceFindMany.mockResolvedValue([{ id: "inv_1" }]);
    const invoiceRow = activityRow({ id: "act_invoice", entityType: "INVOICE", entityId: "inv_1", eventType: "INVOICE_PAID" });
    mockFindMany.mockResolvedValue([invoiceRow]);
    const result = await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(result.activities.map((a) => a.id)).toContain("act_invoice");
    // Invoice ids are looked up scoped to this client + firm, not accepted from a caller.
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "client_1", firmId: "firm_1" } })
    );
  });

  it("C. activity for a quotation belonging to this client appears", async () => {
    mockQuotationFindMany.mockResolvedValue([{ id: "quo_1" }]);
    const quotationRow = activityRow({ id: "act_quotation", entityType: "QUOTATION", entityId: "quo_1", eventType: "QUOTATION_ACCEPTED" });
    mockFindMany.mockResolvedValue([quotationRow]);
    const result = await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(result.activities.map((a) => a.id)).toContain("act_quotation");
    expect(mockQuotationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "client_1", firmId: "firm_1" } })
    );
  });

  it("D. an invoice belonging to a DIFFERENT client can never enter the query — its id is never looked up", async () => {
    // client_1's own invoice lookup only ever returns client_1's invoices (scoped by the where
    // clause itself, asserted above) — so client_2's invoice id is structurally never in the
    // `in: [...]` list, regardless of what Activity rows exist in the table.
    mockInvoiceFindMany.mockResolvedValue([{ id: "inv_client1_only" }]);
    await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    const activityWhere = mockFindMany.mock.calls[0][0].where;
    const invoiceClause = activityWhere.OR.find((c: { entityType: string }) => c.entityType === "INVOICE");
    expect(invoiceClause.entityId.in).toEqual(["inv_client1_only"]);
    expect(invoiceClause.entityId.in).not.toContain("inv_client2");
  });

  it("E. a quotation belonging to a DIFFERENT client can never enter the query — its id is never looked up", async () => {
    mockQuotationFindMany.mockResolvedValue([{ id: "quo_client1_only" }]);
    await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    const activityWhere = mockFindMany.mock.calls[0][0].where;
    const quotationClause = activityWhere.OR.find((c: { entityType: string }) => c.entityType === "QUOTATION");
    expect(quotationClause.entityId.in).toEqual(["quo_client1_only"]);
    expect(quotationClause.entityId.in).not.toContain("quo_other_firm");
  });

  it("F. cross-firm invoices can never enter the query — the id lookup itself is firm-scoped", async () => {
    await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ firmId: "firm_1" }) }));
    // and the final activity read is independently firm-scoped too — a second, redundant guard
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ firmId: "firm_1" }) }));
  });

  it("G. cross-firm quotations can never enter the query — the id lookup itself is firm-scoped", async () => {
    await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(mockQuotationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ firmId: "firm_1" }) }));
  });

  it("H. requests activity ordered newest-first (chronological)", async () => {
    await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" } }));
  });

  it("I. a client with no invoices or quotations still returns cleanly, not an error", async () => {
    mockInvoiceFindMany.mockResolvedValue([]);
    mockQuotationFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([activityRow({ id: "act_only" })]);
    const result = await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(result.ok).toBe(true);
    expect(result.activities).toHaveLength(1);
    const activityWhere = mockFindMany.mock.calls[0][0].where;
    expect(activityWhere.OR.find((c: { entityType: string }) => c.entityType === "INVOICE").entityId.in).toEqual([]);
    expect(activityWhere.OR.find((c: { entityType: string }) => c.entityType === "QUOTATION").entityId.in).toEqual([]);
  });

  it("J. every returned row has exactly the fields ActivityTimeline already knows how to render", async () => {
    mockFindMany.mockResolvedValue([activityRow({})]);
    const result = await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    const row = result.activities[0];
    // These are exactly the fields ActivityTimeline.tsx reads (EVENT_ICON[eventType],
    // actorLabel(), formatTimestamp(), entry.title, entry.description) — no new shape needed.
    expect(row).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        eventType: expect.any(String),
        title: expect.any(String),
        actorType: expect.any(String),
        createdAt: expect.any(Date),
      })
    );
    // No pagination — Phase 1 is an initial merged load only (see doc comment).
    expect(result.nextCursor).toBeNull();
  });

  it("never fetches per-invoice or per-quotation — exactly 3 queries total regardless of volume", async () => {
    mockInvoiceFindMany.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: `inv_${i}` })));
    mockQuotationFindMany.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: `quo_${i}` })));
    await getClientUnifiedActivityTimeline({ firmId: "firm_1", clientId: "client_1" });
    expect(mockInvoiceFindMany).toHaveBeenCalledTimes(1);
    expect(mockQuotationFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});
