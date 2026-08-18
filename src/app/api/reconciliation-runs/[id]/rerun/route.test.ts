import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({ requireSession: () => mockRequireSession() }));

const mockRunFindFirst = vi.fn();
const mockRunFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reconciliationRun: {
      findFirst: (...a: unknown[]) => mockRunFindFirst(...a),
      findUnique: (...a: unknown[]) => mockRunFindUnique(...a),
    },
  },
}));

const mockRerunMatching = vi.fn();
vi.mock("@/lib/reconciliation/pipeline", () => ({
  rerunReconciliationMatching: (...a: unknown[]) => mockRerunMatching(...a),
  PipelineError: class PipelineError extends Error {},
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };
const RUN_ID = "run_1";

function rerunReq() {
  return new NextRequest(`http://localhost/api/reconciliation-runs/${RUN_ID}/rerun`, { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockRunFindFirst.mockResolvedValue({ id: RUN_ID, firmId: "firm_1", status: "MATCHED" });
  mockRerunMatching.mockResolvedValue({ matchedCount: 10, exceptionCount: 2, escalatedCount: 1 });
  mockRunFindUnique.mockResolvedValue({ id: RUN_ID, status: "MATCHED", matchedCount: 10, exceptionCount: 2 });
});

describe("POST /api/reconciliation-runs/[id]/rerun — F2 backend authorization", () => {
  it("7. PARTNER is allowed when the existing status rules permit rerun", async () => {
    const res = await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(res.status).toBe(200);
    expect(mockRerunMatching).toHaveBeenCalledWith({ runId: RUN_ID });
  });

  it("8. MANAGER is allowed when the existing status rules permit rerun", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "MANAGER" } });
    const res = await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(res.status).toBe(200);
  });

  it("9. STAFF is rejected with 403", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(res.status).toBe(403);
  });

  it("10. STAFF's 403 happens before any lookup or rerun — zero DB/pipeline calls", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(mockRunFindFirst).not.toHaveBeenCalled();
    expect(mockRerunMatching).not.toHaveBeenCalled();
  });

  it("11. a cross-firm/nonexistent run still 404s (for an authorized role) — existing behavior preserved", async () => {
    mockRunFindFirst.mockResolvedValue(null);
    const res = await POST(rerunReq(), { params: { id: "other_firms_run" } });
    expect(res.status).toBe(404);
    expect(mockRerunMatching).not.toHaveBeenCalled();
  });

  it("12. the existing UPLOADED/EXTRACTING status restriction (409) remains unchanged for an authorized role", async () => {
    mockRunFindFirst.mockResolvedValue({ id: RUN_ID, firmId: "firm_1", status: "UPLOADED" });
    const res = await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(res.status).toBe(409);
    expect(mockRerunMatching).not.toHaveBeenCalled();

    mockRunFindFirst.mockResolvedValue({ id: RUN_ID, firmId: "firm_1", status: "EXTRACTING" });
    const res2 = await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(res2.status).toBe(409);
  });

  it("13. existing successful rerun behavior is unchanged for an authorized role", async () => {
    const res = await POST(rerunReq(), { params: { id: RUN_ID } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run).toEqual({ id: RUN_ID, status: "MATCHED", matchedCount: 10, exceptionCount: 2 });
    expect(data.summary).toEqual({ matchedCount: 10, exceptionCount: 2, escalatedCount: 1 });
  });
});
