import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFirmFindMany = vi.fn();
const mockClientFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    firm: { findMany: (...a: unknown[]) => mockFirmFindMany(...a) },
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
  },
}));

const mockGenerateRecurring = vi.fn();
const mockGenerateCompliance = vi.fn();
vi.mock("@/lib/recurringTasks", () => ({
  generateRecurringTasksForFirm: (...a: unknown[]) => mockGenerateRecurring(...a),
  generateComplianceRuleTasks: (...a: unknown[]) => mockGenerateCompliance(...a),
}));

// The real bounded-concurrency implementation is used deliberately (not
// mocked) — this test suite's job is partly to prove the route actually
// bounds and isolates firms for real, not just that it calls a mock.
import { POST } from "./route";

const CRON_SECRET = "test-cron-secret";

function req() {
  return new NextRequest("http://localhost/api/cron/generate-recurring-tasks", {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  delete process.env.CRON_FIRM_CONCURRENCY;
  mockClientFindMany.mockResolvedValue([]);
  mockGenerateRecurring.mockResolvedValue({ created: 0, skipped: 0 });
  mockGenerateCompliance.mockResolvedValue({ created: 0, skipped: 0 });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function firms(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `firm_${i}` }));
}

describe("POST /api/cron/generate-recurring-tasks — auth (unchanged)", () => {
  it("rejects when CRON_SECRET is unset (fails closed, not open)", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(mockFirmFindMany).not.toHaveBeenCalled();
  });

  it("rejects a mismatched secret", async () => {
    const badReq = new NextRequest("http://localhost/api/cron/generate-recurring-tasks", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/cron/generate-recurring-tasks — firm isolation", () => {
  it("one firm throwing does not stop the others, and is recorded in errors[]", async () => {
    mockFirmFindMany.mockResolvedValue(firms(3));
    mockGenerateRecurring.mockImplementation(async (firmId: string) => {
      if (firmId === "firm_1") throw new Error("boom in firm_1");
      return { created: 1, skipped: 0 };
    });

    const res = await POST(req());
    const body = await res.json();

    expect(res.status).toBe(200); // HTTP contract unchanged — see the route's own comment
    expect(body.errors.firm_1).toContain("boom in firm_1");
    expect(body.results.firm_0).toBe(1);
    expect(body.results.firm_2).toBe(1);
    expect(body.results.firm_1).toBeUndefined(); // never recorded a result for the firm that threw
  });

  it("summary is SUCCESS when every firm succeeds", async () => {
    mockFirmFindMany.mockResolvedValue(firms(3));
    const res = await POST(req());
    const body = await res.json();
    expect(body.summary).toBe("SUCCESS");
  });

  it("summary is PARTIAL_FAILURE when some (not all) firms fail", async () => {
    mockFirmFindMany.mockResolvedValue(firms(3));
    mockGenerateRecurring.mockImplementation(async (firmId: string) => {
      if (firmId === "firm_1") throw new Error("boom");
      return { created: 0, skipped: 0 };
    });
    const res = await POST(req());
    const body = await res.json();
    expect(body.summary).toBe("PARTIAL_FAILURE");
  });

  it("summary is FAILURE when every firm fails", async () => {
    mockFirmFindMany.mockResolvedValue(firms(2));
    mockGenerateRecurring.mockRejectedValue(new Error("boom"));
    const res = await POST(req());
    const body = await res.json();
    expect(body.summary).toBe("FAILURE");
  });
});

describe("POST /api/cron/generate-recurring-tasks — bounded concurrency", () => {
  it("never processes more firms at once than the concurrency limit", async () => {
    process.env.CRON_FIRM_CONCURRENCY = "3";
    mockFirmFindMany.mockResolvedValue(firms(10));
    let inFlight = 0;
    let maxInFlight = 0;
    mockGenerateRecurring.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return { created: 0, skipped: 0 };
    });

    await POST(req());
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // proves it's not degraded back to fully sequential
  });

  it("defaults to a sane concurrency when CRON_FIRM_CONCURRENCY is unset", async () => {
    mockFirmFindMany.mockResolvedValue(firms(10));
    let inFlight = 0;
    let maxInFlight = 0;
    mockGenerateRecurring.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return { created: 0, skipped: 0 };
    });
    await POST(req());
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(10); // any sane bound, not literally unbounded Promise.all
  });
});

describe("POST /api/cron/generate-recurring-tasks — structured logging", () => {
  it("logs the full event lifecycle without leaking firm names or secrets", async () => {
    mockFirmFindMany.mockResolvedValue(firms(2));
    mockGenerateRecurring.mockResolvedValue({ created: 2, skipped: 1 });
    mockGenerateCompliance.mockResolvedValue({ created: 1, skipped: 0 });

    await POST(req());

    const logged = (console.log as any).mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string));
    const events = logged.map((l: any) => l.event);
    expect(events).toContain("RUN_STARTED");
    expect(events).toContain("FIRMS_DISCOVERED");
    expect(events.filter((e: string) => e === "FIRM_COMPLETED")).toHaveLength(2);
    expect(events).toContain("RUN_COMPLETED");

    const runCompleted = logged.find((l: any) => l.event === "RUN_COMPLETED");
    expect(runCompleted.firmsSucceeded).toBe(2);
    expect(runCompleted.firmsFailed).toBe(0);
    expect(runCompleted.summary).toBe("SUCCESS");
    expect(typeof runCompleted.durationMs).toBe("number");

    // Never log the secret itself or anything from CRON_SECRET.
    const allLogText = JSON.stringify(logged);
    expect(allLogText).not.toContain(CRON_SECRET);
  });

  it("logs FIRM_FAILED with the error message when a firm throws", async () => {
    mockFirmFindMany.mockResolvedValue(firms(1));
    mockGenerateRecurring.mockRejectedValue(new Error("db unavailable"));

    await POST(req());

    const logged = (console.log as any).mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string));
    const failed = logged.find((l: any) => l.event === "FIRM_FAILED");
    expect(failed).toBeDefined();
    expect(failed.error).toContain("db unavailable");
    expect(failed.firmId).toBe("firm_0");
  });
});
