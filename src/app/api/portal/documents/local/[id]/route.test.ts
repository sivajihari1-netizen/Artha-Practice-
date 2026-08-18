import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPortalSession = vi.fn();
vi.mock("@/lib/clientPortalAuth", () => ({
  getPortalSession: () => mockGetPortalSession(),
}));

const mockGetAccessibleClients = vi.fn();
vi.mock("@/lib/clientPortalAccess", () => ({
  getAccessibleClients: (...a: unknown[]) => mockGetAccessibleClients(...a),
}));

const mockDocumentFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: (...a: unknown[]) => mockDocumentFindUnique(...a) },
  },
}));

import { GET } from "./route";

const CLIENT_ID = "client_portal_test";
const uploadsRoot = path.join(process.cwd(), "uploads");
const legitKey = "firmY/client_portal_test/legit-PORTAL-TEST.txt";

function req() {
  return {} as NextRequest;
}

beforeAll(async () => {
  await fs.mkdir(path.join(uploadsRoot, "firmY", CLIENT_ID), { recursive: true });
  await fs.writeFile(path.join(uploadsRoot, legitKey), "LEGIT PORTAL DOCUMENT CONTENTS");
});

afterAll(async () => {
  await fs.rm(uploadsRoot, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPortalSession.mockReturnValue({ email: "client@example.com" });
  mockGetAccessibleClients.mockResolvedValue([{ id: CLIENT_ID }]);
});

describe("GET /api/portal/documents/local/[id] — mirrors the staff route's fix, for the portal's own session mechanism", () => {
  it("legitimate document for an accessible client: 200, correct content", async () => {
    mockDocumentFindUnique.mockResolvedValue({ id: "doc_1", clientId: CLIENT_ID, storageKey: legitKey });
    const res = await GET(req(), { params: { id: "doc_1" } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("LEGIT PORTAL DOCUMENT CONTENTS");
  });

  it("document belonging to a client this portal email cannot access: 404, never trusting a client id from the request", async () => {
    mockDocumentFindUnique.mockResolvedValue({ id: "doc_2", clientId: "some_other_client", storageKey: "firmY/some_other_client/x.txt" });
    mockGetAccessibleClients.mockResolvedValue([{ id: CLIENT_ID }]); // does not include "some_other_client"
    const res = await GET(req(), { params: { id: "doc_2" } });
    expect(res.status).toBe(404);
  });

  it("nonexistent document id: 404", async () => {
    mockDocumentFindUnique.mockResolvedValue(null);
    const res = await GET(req(), { params: { id: "doc_missing" } });
    expect(res.status).toBe(404);
  });

  it("no portal session: 401", async () => {
    mockGetPortalSession.mockReturnValue(null);
    const res = await GET(req(), { params: { id: "doc_1" } });
    expect(res.status).toBe(401);
    expect(mockDocumentFindUnique).not.toHaveBeenCalled();
  });

  it("traversal string used as the id: 404", async () => {
    mockDocumentFindUnique.mockResolvedValue(null);
    const res = await GET(req(), { params: { id: "../../etc/passwd" } });
    expect(res.status).toBe(404);
  });
});
