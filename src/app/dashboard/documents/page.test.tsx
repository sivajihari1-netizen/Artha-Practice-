import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockDocumentFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findMany: (...a: unknown[]) => mockDocumentFindMany(...a) } },
}));

import DocumentsPage from "./page";
import DocumentFileRow from "@/components/DocumentFileRow";

function findAllByType(node: unknown, type: unknown, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByType(n, type, out);
    return out;
  }
  const el = node as any;
  if (el.type === type) out.push(el);
  if (el.props?.children !== undefined) findAllByType(el.props.children, type, out);
  return out;
}

function baseDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc_1",
    fileName: "bank-statement.pdf",
    category: "Bank Statement",
    workType: "GST",
    periodYear: 2026,
    periodMonth: 6,
    sizeBytes: 20480,
    uploadedAt: new Date("2026-06-15"),
    client: { id: "client_1", name: "Acme Pvt Ltd" },
    task: null,
    ...overrides,
  };
}

describe("Documents vault — Batch B item 4: client/task link parity with Client 360's own DocumentsPanel", () => {
  it("passes clientId and task through to DocumentFileRow at the leaf (file-list) level", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockDocumentFindMany.mockResolvedValue([
      baseDoc({ task: { id: "task_1", title: "GSTR-3B — June" } }),
    ]);

    const tree = await DocumentsPage({ searchParams: { year: "2026", workType: "GST", month: "6" } });
    const rows = findAllByType(tree, DocumentFileRow);
    expect(rows).toHaveLength(1);
    expect(rows[0].props.doc.clientId).toBe("client_1");
    expect(rows[0].props.doc.task).toEqual({ id: "task_1", title: "GSTR-3B — June" });
  });

  it("a document with no linked task passes task: null through, not a fabricated value", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockDocumentFindMany.mockResolvedValue([baseDoc({ task: null })]);

    const tree = await DocumentsPage({ searchParams: { year: "2026", workType: "GST", month: "6" } });
    const rows = findAllByType(tree, DocumentFileRow);
    expect(rows[0].props.doc.task).toBeNull();
  });

  it("the document query stays firm-scoped", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockDocumentFindMany.mockResolvedValue([]);
    await DocumentsPage({ searchParams: {} });
    expect(mockDocumentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { firmId: "firm_1", status: "ACTIVE" } }));
  });
});
