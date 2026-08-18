import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  requireSession: () => mockRequireSession(),
}));

const mockDocumentFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: (...a: unknown[]) => mockDocumentFindFirst(...a) },
  },
}));

// readLocalFile is NOT mocked — real filesystem, real containment check —
// this is the same reasoning as storage.test.ts: this is exactly the
// security-critical path, so it's tested end-to-end for real.
import { GET } from "./route";

const FIRM_A = "firmA_route_test";
const uploadsRoot = path.join(process.cwd(), "uploads");
const outsideFile = path.join(process.cwd(), "outside-secret-ROUTE-TEST.txt");
const legitKey = `${FIRM_A}/clientX/legit-ROUTE-TEST.txt`;

function req() {
  return {} as NextRequest;
}

beforeAll(async () => {
  await fs.mkdir(path.join(uploadsRoot, FIRM_A, "clientX"), { recursive: true });
  await fs.writeFile(path.join(uploadsRoot, legitKey), "LEGIT DOCUMENT CONTENTS");
  await fs.writeFile(outsideFile, "OUTSIDE UPLOADS ROOT — MUST NEVER BE READABLE");
});

afterAll(async () => {
  await fs.rm(uploadsRoot, { recursive: true, force: true });
  await fs.rm(outsideFile, { force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: { firmId: FIRM_A, userId: "u1", role: "PARTNER", email: "a@test.local" } });
});

describe("GET /api/documents/local/[id]", () => {
  it("A. legitimate same-firm document: 200, correct file content", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: FIRM_A, storageKey: legitKey });
    const res = await GET(req(), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("LEGIT DOCUMENT CONTENTS");
  });

  it("B. only the requested document is ever returned — the DB lookup is scoped to the exact id requested", async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_1", firmId: FIRM_A, storageKey: legitKey });
    await GET(req(), { params: { id: "doc_1" } });
    expect(mockDocumentFindFirst).toHaveBeenCalledWith({ where: { id: "doc_1", firmId: FIRM_A } });
  });

  it("C. cross-firm document id: 404 (findFirst is itself firm-scoped, so a cross-firm id simply matches nothing)", async () => {
    mockDocumentFindFirst.mockResolvedValue(null); // simulates the real firm-scoped query finding no row
    const res = await GET(req(), { params: { id: "doc_owned_by_firm_b" } });
    expect(res.status).toBe(404);
  });

  it("D. nonexistent document id: 404", async () => {
    mockDocumentFindFirst.mockResolvedValue(null);
    const res = await GET(req(), { params: { id: "doc_does_not_exist" } });
    expect(res.status).toBe(404);
  });

  it("E. traversal string used as the id itself: 404 (Prisma treats it as a literal id to match, not a path — nothing matches)", async () => {
    mockDocumentFindFirst.mockResolvedValue(null);
    const res = await GET(req(), { params: { id: "../../etc/passwd" } });
    expect(res.status).toBe(404);
    expect(mockDocumentFindFirst).toHaveBeenCalledWith({ where: { id: "../../etc/passwd", firmId: FIRM_A } });
  });

  it("F. URL-encoded traversal string used as the id itself: 404", async () => {
    mockDocumentFindFirst.mockResolvedValue(null);
    const res = await GET(req(), { params: { id: "%2e%2e%2f%2e%2e%2fetc%2fpasswd" } });
    expect(res.status).toBe(404);
  });

  it("returns 401 when there is no authenticated session", async () => {
    const unauthorized = new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    mockRequireSession.mockReturnValue({ error: unauthorized });
    const res = await GET(req(), { params: { id: "doc_1" } });
    expect(res.status).toBe(401);
    expect(mockDocumentFindFirst).not.toHaveBeenCalled();
  });
});

describe("Security regression (Phase 8) — real filesystem, temporary harmless files only", () => {
  it("Firm A session cannot retrieve Firm B's document: the firm-scoped DB lookup returns nothing, so the file is never even attempted", async () => {
    // The real ownership boundary is the firmId-scoped Prisma query — a
    // session for Firm A can never construct a query that matches Firm B's
    // document row, regardless of what id it supplies.
    mockDocumentFindFirst.mockResolvedValue(null);
    const res = await GET(req(), { params: { id: "doc_owned_by_firm_b" } });
    expect(res.status).toBe(404);
  });

  it("Firm A session cannot read an arbitrary file outside uploads/, even if a document row's storageKey were somehow malicious (defense in depth)", async () => {
    // Simulates the failure mode the containment check exists for: even if
    // something upstream ever put a bad value in storageKey, the route
    // still can't be used to read outside uploads/ — readLocalFile itself
    // (real, unmocked) rejects it before any file content is returned.
    mockDocumentFindFirst.mockResolvedValue({ id: "doc_bad", firmId: FIRM_A, storageKey: `${FIRM_A}/../../outside-secret-ROUTE-TEST.txt` });
    const res = await GET(req(), { params: { id: "doc_bad" } });
    expect(res.status).toBe(404); // the route's catch block maps the containment rejection to "File not found"
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("OUTSIDE UPLOADS ROOT");
  });
});
