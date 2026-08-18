import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// requireSession/prisma/logAudit are mocked so this test exercises only the
// route's own logic (validation, firm-scoping, status transitions) — not a
// real DB or a real session. This is the first route-handler test in the
// repo; existing tests only cover pure lib functions (see match.test.ts),
// but the resolve/ignore endpoint's auth/firm-isolation behavior is exactly
// what this task needs regression coverage for, so it's worth the one-off
// mocking setup rather than skipping API-level coverage entirely.
const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockRunUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reconciliationMatch: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    reconciliationRun: {
      update: (...args: unknown[]) => mockRunUpdate(...args),
    },
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { RECONCILIATION_RESOLVED: "RECONCILIATION_RESOLVED", RECONCILIATION_IGNORED: "RECONCILIATION_IGNORED" },
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
}));

import { PATCH } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "STAFF" as const, email: "staff@firm.test" };
const MATCH_ID = "match_1";

function req(body: unknown) {
  return new NextRequest(`http://localhost/api/reconciliation-matches/${MATCH_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseMatch(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MATCH_ID,
    reconciliationRunId: "run_1",
    status: "EXCEPTION",
    resolutionNote: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...baseMatch(), ...data }));
  mockCount.mockResolvedValue(0); // no other exceptions remaining on the run, by default
});

describe("PATCH /api/reconciliation-matches/[id] — resolution note wiring", () => {
  it("resolves without a note (note stays optional)", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    const res = await PATCH(req({ action: "resolve" }), { params: { id: MATCH_ID } });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED", resolutionNote: undefined }) })
    );
  });

  it("resolves with a note and stores it as resolutionNote", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    const res = await PATCH(req({ action: "resolve", note: "Confirmed with client, invoice booked late." }), {
      params: { id: MATCH_ID },
    });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED", resolutionNote: "Confirmed with client, invoice booked late." }),
      })
    );
  });

  it("ignores without a note", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    const res = await PATCH(req({ action: "ignore" }), { params: { id: MATCH_ID } });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IGNORED", resolutionNote: undefined }) })
    );
  });

  it("ignores with a note", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    const res = await PATCH(req({ action: "ignore", note: "Immaterial rounding difference." }), {
      params: { id: MATCH_ID },
    });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IGNORED", resolutionNote: "Immaterial rounding difference." }) })
    );
  });

  it("rejects a note beyond the API's max length (400) without touching the match", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    const res = await PATCH(req({ action: "resolve", note: "a".repeat(2001) }), { params: { id: MATCH_ID } });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for a match belonging to another firm (firm isolation)", async () => {
    // findFirst is itself firm-scoped in the real query (reconciliationRun: { firmId }) —
    // simulating the resulting "not found" rather than a leaky 403.
    mockFindFirst.mockResolvedValue(null);
    const res = await PATCH(req({ action: "resolve" }), { params: { id: MATCH_ID } });
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no authenticated session", async () => {
    const unauthorized = new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    mockRequireSession.mockReturnValue({ error: unauthorized });
    const res = await PATCH(req({ action: "resolve" }), { params: { id: MATCH_ID } });
    expect(res.status).toBe(401);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("existing behavior unchanged: a match that isn't EXCEPTION can't be resolved/ignored again", async () => {
    mockFindFirst.mockResolvedValue(baseMatch({ status: "RESOLVED" }));
    const res = await PATCH(req({ action: "resolve", note: "trying again" }), { params: { id: MATCH_ID } });
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("existing behavior unchanged: closes the run once the last exception is resolved", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    mockCount.mockResolvedValue(0);
    await PATCH(req({ action: "resolve", note: "Last one, all clear." }), { params: { id: MATCH_ID } });
    expect(mockRunUpdate).toHaveBeenCalledWith({ where: { id: "run_1" }, data: { status: "CLOSED" } });
  });

  it("existing behavior unchanged: does not close the run while other exceptions remain", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    mockCount.mockResolvedValue(2);
    await PATCH(req({ action: "resolve" }), { params: { id: MATCH_ID } });
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/reconciliation-matches/[id] — activity recording", () => {
  it("records RECONCILIATION_RESOLVED against the parent run, referencing the match in metadata", async () => {
    mockFindFirst.mockResolvedValue(baseMatch({ exceptionReason: "AMOUNT_MISMATCH" }));
    await PATCH(req({ action: "resolve", note: "Confirmed with client." }), { params: { id: MATCH_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "RECONCILIATION",
        entityId: "run_1",
        eventType: "RECONCILIATION_RESOLVED",
        metadata: { matchId: MATCH_ID, exceptionReason: "AMOUNT_MISMATCH", hasNote: true },
      })
    );
  });

  it("records RECONCILIATION_IGNORED for the ignore action, with hasNote:false when no note is given", async () => {
    mockFindFirst.mockResolvedValue(baseMatch());
    await PATCH(req({ action: "ignore" }), { params: { id: MATCH_ID } });
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "RECONCILIATION_IGNORED", metadata: expect.objectContaining({ hasNote: false }) })
    );
  });

  it("does not record an activity when the action is rejected (already-resolved match)", async () => {
    mockFindFirst.mockResolvedValue(baseMatch({ status: "RESOLVED" }));
    await PATCH(req({ action: "resolve" }), { params: { id: MATCH_ID } });
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
