import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockClientFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) } },
}));

import ClientsPage from "./page";

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

function findAllByProp(node: unknown, propName: string, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByProp(n, propName, out);
    return out;
  }
  const el = node as any;
  if (el.props?.[propName] !== undefined) out.push(el);
  if (el.props?.children !== undefined) findAllByProp(el.props.children, propName, out);
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
  mockClientFindMany.mockResolvedValue([]);
});

describe("Clients list — Batch C: archived-clients view (the other half of Client archive)", () => {
  it("without ?status=archived, only active clients are queried — unchanged default", async () => {
    await ClientsPage({ searchParams: {} });
    expect(mockClientFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { firmId: "firm_1", active: true } }));
  });

  it("?status=archived queries only inactive clients", async () => {
    await ClientsPage({ searchParams: { status: "archived" } });
    expect(mockClientFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { firmId: "firm_1", active: false } }));
  });

  it("the toggle link points at the archived view when showing active, and back when showing archived", async () => {
    const activeTree = await ClientsPage({ searchParams: {} });
    const activeLinks = findAllByProp(activeTree, "href").map((el) => el.props.href);
    expect(activeLinks).toContain("/dashboard/clients?status=archived");

    const archivedTree = await ClientsPage({ searchParams: { status: "archived" } });
    const archivedLinks = findAllByProp(archivedTree, "href").map((el) => el.props.href);
    expect(archivedLinks).toContain("/dashboard/clients");
  });

  it("shows a distinct empty state for the archived view", async () => {
    mockClientFindMany.mockResolvedValue([]);
    const tree = await ClientsPage({ searchParams: { status: "archived" } });
    expect(textOf(tree)).toContain("No archived clients.");
  });
});
