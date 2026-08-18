import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockClientFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) } },
}));

import ReconciliationUploadPage from "./page";
import ReconciliationUploadForm from "@/components/ReconciliationUploadForm";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";

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

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

const FIRM_ID = "firm_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockClientFindMany.mockResolvedValue([{ id: "client_1", name: "Acme" }]);
});

describe("Reconciliation Upload page — firm isolation", () => {
  it("fetches only this firm's clients for the dropdown", async () => {
    await ReconciliationUploadPage();
    expect(mockClientFindMany).toHaveBeenCalledWith({ where: { firmId: FIRM_ID }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  });
});

describe("Reconciliation Upload page — form wiring", () => {
  it("passes the firm-scoped client list straight through to the upload form", async () => {
    const tree = await ReconciliationUploadPage();
    const forms = findAllByType(tree, ReconciliationUploadForm);
    expect(forms).toHaveLength(1);
    expect(forms[0].props.clients).toEqual([{ id: "client_1", name: "Acme" }]);
  });

  it("client list never scans reconciliation runs to build itself — no N+1, one query", async () => {
    await ReconciliationUploadPage();
    expect(mockClientFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("Reconciliation Upload page — F2 Security Refinement: role gating", () => {
  it("PARTNER sees the upload form", async () => {
    const tree = await ReconciliationUploadPage();
    expect(findAllByType(tree, ReconciliationUploadForm)).toHaveLength(1);
  });

  it("MANAGER sees the upload form", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "MANAGER", email: "m@firm.test" });
    const tree = await ReconciliationUploadPage();
    expect(findAllByType(tree, ReconciliationUploadForm)).toHaveLength(1);
  });

  it("STAFF never sees the upload form — replaced by a plain permission message, no disabled button", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const tree = await ReconciliationUploadPage();
    expect(findAllByType(tree, ReconciliationUploadForm)).toHaveLength(0);
    expect(textOf(tree)).toContain("Only Partners and Managers can upload reconciliation files.");
  });

  it("STAFF: the firm's client list is never even queried (form is hidden, no need for it)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    await ReconciliationUploadPage();
    expect(mockClientFindMany).not.toHaveBeenCalled();
  });

  it("passes canManageReconciliation through to the subnav (STAFF:false, PARTNER:true)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "STAFF", email: "s@firm.test" });
    const staffTree = await ReconciliationUploadPage();
    expect(findAllByType(staffTree, ReconciliationSubNav)[0].props.canManageReconciliation).toBe(false);

    mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
    const partnerTree = await ReconciliationUploadPage();
    expect(findAllByType(partnerTree, ReconciliationSubNav)[0].props.canManageReconciliation).toBe(true);
  });
});
