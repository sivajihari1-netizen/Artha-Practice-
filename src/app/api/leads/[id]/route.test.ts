import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockFindFirst = vi.fn();
const mockTxLeadUpdate = vi.fn();
const mockTxClientCreate = vi.fn();
const mockTxContactPersonCreate = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
  cb({
    lead: { update: (...args: unknown[]) => mockTxLeadUpdate(...args) },
    client: { create: (...args: unknown[]) => mockTxClientCreate(...args) },
    contactPerson: { create: (...args: unknown[]) => mockTxContactPersonCreate(...args) },
  })
);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    $transaction: (cb: (tx: unknown) => unknown) => mockTransaction(cb),
  },
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: {
    CLIENT_CREATED: "CLIENT_CREATED",
    LEAD_CREATED: "LEAD_CREATED",
    LEAD_UPDATED: "LEAD_UPDATED",
    LEAD_STAGE_CHANGED: "LEAD_STAGE_CHANGED",
    LEAD_CONVERTED: "LEAD_CONVERTED",
  },
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
}));

import { PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "STAFF" as const, email: "staff@firm.test" };
const LEAD_ID = "lead_1";

function req(body: unknown) {
  return new NextRequest(`http://localhost/api/leads/${LEAD_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseLead(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LEAD_ID,
    firmId: SESSION.firmId,
    name: "ABC Industries",
    stage: "PROPOSAL_SENT",
    notes: null,
    convertedClientId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockTxClientCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "client_new", ...data }));
  mockTxLeadUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...baseLead(), ...data }));
});

describe("PATCH /api/leads/[id] — notes", () => {
  it("updates notes without touching stage or triggering conversion", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    const res = await PATCH(req({ notes: "Budget approved, follow up after 15 August." }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    expect(mockTxClientCreate).not.toHaveBeenCalled();
    expect(mockTxLeadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: "Budget approved, follow up after 15 August." } })
    );
  });

  it("allows clearing a note to an empty string", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ notes: "old note" }));
    const res = await PATCH(req({ notes: "" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    expect(mockTxLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { notes: "" } }));
  });

  it("records LEAD_UPDATED (not LEAD_STAGE_CHANGED) for a notes-only edit", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ notes: "old note" }));
    await PATCH(req({ notes: "new note" }), { params: { id: LEAD_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "LEAD_UPDATED" }));
    const eventTypes = mockRecordActivity.mock.calls.map((call) => (call[0] as { eventType: string }).eventType);
    expect(eventTypes).not.toContain("LEAD_STAGE_CHANGED");
  });

  it("records nothing when notes are sent but unchanged", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ notes: "same note" }));
    await PATCH(req({ notes: "same note" }), { params: { id: LEAD_ID } });
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/leads/[id] — stage change (non-conversion)", () => {
  it("records LEAD_STAGE_CHANGED for an ordinary stage move", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ stage: "NEW" }));
    await PATCH(req({ stage: "CONTACTED" }), { params: { id: LEAD_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAD_STAGE_CHANGED", metadata: { fromStage: "NEW", toStage: "CONTACTED" } })
    );
  });
});

describe("PATCH /api/leads/[id] — archive (Batch C: moving to LOST)", () => {
  it("archiving (stage -> LOST) records LEAD_STAGE_CHANGED like any other stage move — no new event type invented", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ stage: "PROPOSAL_SENT" }));
    const res = await PATCH(req({ stage: "LOST" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAD_STAGE_CHANGED", metadata: { fromStage: "PROPOSAL_SENT", toStage: "LOST" } })
    );
  });

  it("a lead can be moved back out of LOST into an active stage — archiving is reversible, nothing is deleted", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ stage: "LOST" }));
    const res = await PATCH(req({ stage: "CONTACTED" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    const [{ data }] = mockTxLeadUpdate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.stage).toBe("CONTACTED");
  });

  it("is reachable by any authenticated role today, including STAFF — confirms the existing (unchanged) backend has no role gate here", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await PATCH(req({ stage: "LOST" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/leads/[id] — WON conversion", () => {
  it("creates a Client and populates convertedClientId on first conversion", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    const res = await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    expect(mockTxClientCreate).toHaveBeenCalledWith({ data: { firmId: "firm_1", name: "ABC Industries" } });
    expect(mockTxLeadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: "WON", convertedClientId: "client_new" }) })
    );
  });

  it("records both CLIENT_CREATED and LEAD_CONVERTED, inside the transaction (db: tx), on first conversion", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    const eventTypes = mockRecordActivity.mock.calls.map((call) => (call[0] as { eventType: string }).eventType);
    expect(eventTypes).toEqual(expect.arrayContaining(["CLIENT_CREATED", "LEAD_CONVERTED"]));
    for (const call of mockRecordActivity.mock.calls) {
      expect((call[0] as { db?: unknown }).db).toBeDefined(); // participates in the same tx as the writes, not a standalone call
    }
  });

  it("does not record CLIENT_CREATED/LEAD_CONVERTED again on idempotent re-conversion", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ stage: "LOST", convertedClientId: "client_existing" }));
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    const eventTypes = mockRecordActivity.mock.calls.map((call) => (call[0] as { eventType: string }).eventType);
    expect(eventTypes).not.toContain("CLIENT_CREATED");
    expect(eventTypes).not.toContain("LEAD_CONVERTED");
    // Still gets its ordinary stage-change activity, since the stage really did move.
    expect(eventTypes).toContain("LEAD_STAGE_CHANGED");
  });

  it("creates the Client under the same firm as the Lead", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    const [{ data }] = mockTxClientCreate.mock.calls[0] as [{ data: { firmId: string } }];
    expect(data.firmId).toBe(SESSION.firmId);
  });

  it("does not create a second Client when a lead already has convertedClientId set (idempotent re-conversion)", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ stage: "LOST", convertedClientId: "client_existing" }));
    const res = await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    expect(mockTxClientCreate).not.toHaveBeenCalled();
    // Still updates stage — just doesn't touch convertedClientId or re-trigger conversion.
    const [{ data }] = mockTxLeadUpdate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.stage).toBe("WON");
    expect(data.convertedClientId).toBeUndefined();
  });

  it("rolls back atomically: if Client creation fails, the Lead is never marked converted, and no activity is recorded", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    mockTxClientCreate.mockRejectedValue(new Error("db unavailable"));
    await expect(PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } })).rejects.toThrow("db unavailable");
    expect(mockTxLeadUpdate).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("moving to a non-WON stage never creates a Client", async () => {
    mockFindFirst.mockResolvedValue(baseLead());
    const res = await PATCH(req({ stage: "CONTACTED" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(200);
    expect(mockTxClientCreate).not.toHaveBeenCalled();
    const [{ data }] = mockTxLeadUpdate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.stage).toBe("CONTACTED");
  });
});

describe("PATCH /api/leads/[id] — P0.4: carrying phone/email into a Contact Person on conversion", () => {
  it("creates a primary Contact Person from the Lead's phone and email on first conversion", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ phone: "+919876543210", email: "founder@abc.test" }));
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(mockTxContactPersonCreate).toHaveBeenCalledWith({
      data: { clientId: "client_new", name: "ABC Industries", phone: "+919876543210", email: "founder@abc.test", isPrimary: true },
    });
  });

  it("creates a Contact Person when only phone is known (email null)", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ phone: "+919876543210", email: null }));
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(mockTxContactPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: "+919876543210", email: null }) })
    );
  });

  it("creates a Contact Person when only email is known (phone null)", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ phone: null, email: "founder@abc.test" }));
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(mockTxContactPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null, email: "founder@abc.test" }) })
    );
  });

  it("creates no Contact Person when the Lead has neither phone nor email — no empty/nameless row", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ phone: null, email: null }));
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(mockTxContactPersonCreate).not.toHaveBeenCalled();
  });

  it("never creates a second Contact Person on idempotent re-conversion (already-converted lead)", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ stage: "LOST", convertedClientId: "client_existing", phone: "+919876543210", email: "founder@abc.test" }));
    await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(mockTxContactPersonCreate).not.toHaveBeenCalled();
  });

  it("rolls back the Contact Person too if the transaction fails", async () => {
    mockFindFirst.mockResolvedValue(baseLead({ phone: "+919876543210" }));
    mockTxClientCreate.mockRejectedValue(new Error("db unavailable"));
    await expect(PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } })).rejects.toThrow("db unavailable");
    expect(mockTxContactPersonCreate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/leads/[id] — firm isolation", () => {
  it("returns 404 and never touches the DB for a lead belonging to another firm", async () => {
    // findFirst is itself firm-scoped ({ id, firmId: auth.session.firmId }) —
    // simulating the resulting "not found" for a cross-firm id.
    mockFindFirst.mockResolvedValue(null);
    const res = await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no authenticated session", async () => {
    const unauthorized = new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    mockRequireSession.mockReturnValue({ error: unauthorized });
    const res = await PATCH(req({ stage: "WON" }), { params: { id: LEAD_ID } });
    expect(res.status).toBe(401);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
