import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({ requireSession: () => mockRequireSession() }));

const mockClientFindFirst = vi.fn();
const mockRunFindFirst = vi.fn();
const mockRunCreate = vi.fn();
const mockRunFindUnique = vi.fn();
const mockDocumentFindFirst = vi.fn();
const mockDocumentCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: (...a: unknown[]) => mockClientFindFirst(...a) },
    reconciliationRun: {
      findFirst: (...a: unknown[]) => mockRunFindFirst(...a),
      create: (...a: unknown[]) => mockRunCreate(...a),
      findUnique: (...a: unknown[]) => mockRunFindUnique(...a),
    },
    document: {
      findFirst: (...a: unknown[]) => mockDocumentFindFirst(...a),
      create: (...a: unknown[]) => mockDocumentCreate(...a),
    },
  },
}));

const mockStoreFile = vi.fn();
vi.mock("@/lib/storage", () => ({ storeFile: (...a: unknown[]) => mockStoreFile(...a) }));

vi.mock("@/lib/documentValidation", () => ({
  sanitizeFileName: (n: string) => n,
  computeChecksum: () => "checksum123",
  defaultRetentionExpiry: () => new Date("2027-01-01"),
}));

const mockRunPipeline = vi.fn();
vi.mock("@/lib/reconciliation/pipeline", () => ({
  runReconciliationPipeline: (...a: unknown[]) => mockRunPipeline(...a),
  PipelineError: class PipelineError extends Error {},
}));

vi.mock("@/lib/reconciliation/extract", () => ({
  ExtractionError: class ExtractionError extends Error {},
}));

const mockRecordActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  ActivityEvent: { RECONCILIATION_CREATED: "RECONCILIATION_CREATED", RECONCILIATION_EXCEPTION: "RECONCILIATION_EXCEPTION" },
  recordActivity: (...a: unknown[]) => mockRecordActivity(...a),
}));

import { POST } from "./route";

const SESSION = { userId: "user_1", firmId: "firm_1", role: "PARTNER" as const, email: "p@firm.test" };
const CLIENT_ID = "client_1";

function makeFile(name: string, content = "a,b,c\n1,2,3") {
  return new File([content], name, { type: "text/csv" });
}

function uploadReq(fields: Partial<Record<string, string>> = {}, files: { sourceAFile?: File; sourceBFile?: File } = {}) {
  const fd = new FormData();
  fd.set("type", fields.type ?? "GST_2B_VS_PURCHASE");
  fd.set("periodStart", fields.periodStart ?? "2026-06-01T00:00:00.000Z");
  fd.set("periodEnd", fields.periodEnd ?? "2026-06-30T00:00:00.000Z");
  fd.set("sourceAFile", files.sourceAFile ?? makeFile("gstr2b.csv"));
  fd.set("sourceBFile", files.sourceBFile ?? makeFile("purchase.csv"));
  return new NextRequest(`http://localhost/api/clients/${CLIENT_ID}/reconciliation-runs`, { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: SESSION });
  mockClientFindFirst.mockResolvedValue({ id: CLIENT_ID, firmId: "firm_1", name: "Acme", gstin: null });
  mockRunFindFirst.mockResolvedValue(null); // no existing idempotent run
  mockDocumentFindFirst.mockResolvedValue(null);
  mockDocumentCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "doc_new", ...data }));
  mockStoreFile.mockResolvedValue(undefined);
  mockRunCreate.mockResolvedValue({ id: "run_new", firmId: "firm_1", clientId: CLIENT_ID, status: "UPLOADED" });
  mockRunFindUnique.mockResolvedValue({ id: "run_new", status: "MATCHED", matchedCount: 5, exceptionCount: 1 });
  mockRunPipeline.mockResolvedValue({ matchedCount: 5, exceptionCount: 1, escalatedCount: 0 });
});

describe("POST /api/clients/[id]/reconciliation-runs — F2 backend authorization", () => {
  it("1. PARTNER is allowed", async () => {
    const res = await POST(uploadReq(), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(201);
  });

  it("2. MANAGER is allowed", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "MANAGER" } });
    const res = await POST(uploadReq(), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(201);
  });

  it("3. STAFF is rejected with 403", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    const res = await POST(uploadReq(), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(403);
  });

  it("4. STAFF's 403 happens before any lookup or mutation — zero DB/pipeline/storage calls", async () => {
    mockRequireSession.mockReturnValue({ session: { ...SESSION, role: "STAFF" } });
    await POST(uploadReq(), { params: { id: CLIENT_ID } });
    expect(mockClientFindFirst).not.toHaveBeenCalled();
    expect(mockRunCreate).not.toHaveBeenCalled();
    expect(mockRunPipeline).not.toHaveBeenCalled();
    expect(mockStoreFile).not.toHaveBeenCalled();
    expect(mockDocumentCreate).not.toHaveBeenCalled();
  });

  it("5. a cross-firm/nonexistent client still 404s (for an authorized role) — existing behavior preserved", async () => {
    mockClientFindFirst.mockResolvedValue(null);
    const res = await POST(uploadReq(), { params: { id: "other_firms_client" } });
    expect(res.status).toBe(404);
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  it("6. existing successful upload behavior is unchanged for an authorized role", async () => {
    const res = await POST(uploadReq(), { params: { id: CLIENT_ID } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.run).toEqual({ id: "run_new", status: "MATCHED", matchedCount: 5, exceptionCount: 1 });
    expect(mockClientFindFirst).toHaveBeenCalledWith({ where: { id: CLIENT_ID, firmId: "firm_1" } });
    expect(mockRunCreate).toHaveBeenCalledTimes(1);
    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
  });
});
