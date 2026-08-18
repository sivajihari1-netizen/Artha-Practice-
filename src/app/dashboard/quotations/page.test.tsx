import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockQuotationFindMany = vi.fn();
const mockClientFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quotation: { findMany: (...a: unknown[]) => mockQuotationFindMany(...a) },
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
  },
}));

import QuotationsPage from "./page";
import ListFilterBar from "@/components/ListFilterBar";

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
const CLIENT_QUOTATION = { id: "quo_1", quotationNumber: "QUO/2026-27/0001", client: { name: "Acme Pvt Ltd" }, prospectName: null, serviceType: "GST", issueDate: new Date(), status: "SENT" };
const PROSPECT_QUOTATION = { id: "quo_2", quotationNumber: "QUO/2026-27/0002", client: null, prospectName: "Beta Traders", serviceType: "AUDIT", issueDate: new Date(), status: "DRAFT" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockQuotationFindMany.mockResolvedValue([CLIENT_QUOTATION]);
  mockClientFindMany.mockResolvedValue([{ id: "client_1", name: "Acme Pvt Ltd" }]);
});

describe("Quotations list — Batch E: no filters (existing behavior unchanged)", () => {
  it("queries with exactly the pre-Batch-E where clause when no filters are present", async () => {
    await QuotationsPage({ searchParams: {} });
    expect(mockQuotationFindMany).toHaveBeenCalledWith({
      where: { firmId: FIRM_ID },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("renders the standard empty-state text when nothing is returned and no filters are active", async () => {
    mockQuotationFindMany.mockResolvedValue([]);
    const tree = await QuotationsPage({ searchParams: {} });
    expect(textOf(tree)).toContain("No quotations yet.");
  });
});

describe("Quotations list — Batch E: status filter", () => {
  it("adds a validated status to the where clause", async () => {
    await QuotationsPage({ searchParams: { status: "ACCEPTED" } });
    expect(mockQuotationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, status: "ACCEPTED" } })
    );
  });

  it("ignores an invalid/unknown status value instead of passing it to Prisma", async () => {
    await QuotationsPage({ searchParams: { status: "NOT_A_REAL_STATUS" } });
    expect(mockQuotationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID } })
    );
  });
});

describe("Quotations list — Batch E: client filter", () => {
  it("adds clientId to the where clause, ANDed with firmId", async () => {
    await QuotationsPage({ searchParams: { clientId: "client_1" } });
    expect(mockQuotationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, clientId: "client_1" } })
    );
  });

  it("a cross-firm clientId is still ANDed with this session's firmId — structurally can never match another firm's row", async () => {
    await QuotationsPage({ searchParams: { clientId: "someone_elses_client" } });
    const [{ where }] = mockQuotationFindMany.mock.calls[0];
    expect(where.firmId).toBe(FIRM_ID);
    expect(where.clientId).toBe("someone_elses_client");
  });

  it("a nonexistent/cross-firm client yields the filtered empty state, not the generic one", async () => {
    mockQuotationFindMany.mockResolvedValue([]);
    const tree = await QuotationsPage({ searchParams: { clientId: "someone_elses_client" } });
    expect(textOf(tree)).toContain("No quotations match the selected filters.");
    expect(textOf(tree)).not.toContain("No quotations yet.");
  });

  it("filtering by a real client never matches a prospect-only quotation (clientId: null)", async () => {
    // Prisma's own semantics: {clientId: "client_1"} can't match a row whose
    // clientId is null. Asserting the where clause is correct is sufficient
    // — the actual match/no-match behavior is Prisma's, not app logic.
    await QuotationsPage({ searchParams: { clientId: "client_1" } });
    const [{ where }] = mockQuotationFindMany.mock.calls[0];
    expect(where.clientId).toBe("client_1");
  });

  it("prospect quotations (clientId: null) still render fine in an unfiltered list, using prospectName", async () => {
    mockQuotationFindMany.mockResolvedValue([PROSPECT_QUOTATION]);
    const tree = await QuotationsPage({ searchParams: {} });
    expect(textOf(tree)).toContain("Beta Traders");
  });
});

describe("Quotations list — Batch E: status + client combined", () => {
  it("both filters land in the same where clause together", async () => {
    await QuotationsPage({ searchParams: { status: "DECLINED", clientId: "client_1" } });
    expect(mockQuotationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, status: "DECLINED", clientId: "client_1" } })
    );
  });
});

describe("Quotations list — Batch E: ordering/pagination preserved", () => {
  it("orderBy createdAt desc is unchanged regardless of which filters are active", async () => {
    await QuotationsPage({ searchParams: { status: "SENT", clientId: "client_1" } });
    const [{ orderBy }] = mockQuotationFindMany.mock.calls[0];
    expect(orderBy).toEqual({ createdAt: "desc" });
  });

  it("only one quotation query and one client query run — no N+1", async () => {
    mockQuotationFindMany.mockResolvedValue([CLIENT_QUOTATION, PROSPECT_QUOTATION]);
    await QuotationsPage({ searchParams: {} });
    expect(mockQuotationFindMany).toHaveBeenCalledTimes(1);
    expect(mockClientFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("Quotations list — Batch E: filter bar rendering", () => {
  it("renders ListFilterBar with the full QuotationStatus enum and the firm's own clients", async () => {
    const tree = await QuotationsPage({ searchParams: {} });
    const bars = findAllByType(tree, ListFilterBar);
    expect(bars).toHaveLength(1);
    expect(bars[0].props.statusOptions).toEqual(["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"]);
    expect(bars[0].props.clients).toEqual([{ id: "client_1", name: "Acme Pvt Ltd" }]);
  });
});
