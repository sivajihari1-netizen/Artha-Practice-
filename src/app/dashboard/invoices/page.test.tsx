import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockInvoiceFindMany = vi.fn();
const mockClientFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findMany: (...a: unknown[]) => mockInvoiceFindMany(...a) },
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
  },
}));

import InvoicesPage from "./page";
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
const INVOICE_FIXTURE = { id: "inv_1", invoiceNumber: "INV/2026-27/0001", client: { name: "Acme Pvt Ltd" }, issueDate: new Date(), dueDate: null, total: 10000, status: "SENT" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ userId: "user_1", firmId: FIRM_ID, role: "PARTNER", email: "p@firm.test" });
  mockInvoiceFindMany.mockResolvedValue([INVOICE_FIXTURE]);
  mockClientFindMany.mockResolvedValue([{ id: "client_1", name: "Acme Pvt Ltd" }]);
});

describe("Invoices list — Batch E: no filters (existing behavior unchanged)", () => {
  it("queries with exactly the pre-Batch-E where clause when no filters are present", async () => {
    await InvoicesPage({ searchParams: {} });
    expect(mockInvoiceFindMany).toHaveBeenCalledWith({
      where: { firmId: FIRM_ID },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("renders the unfiltered invoice list and the standard empty-state text when nothing is returned", async () => {
    mockInvoiceFindMany.mockResolvedValue([]);
    const tree = await InvoicesPage({ searchParams: {} });
    expect(textOf(tree)).toContain("No invoices yet.");
  });
});

describe("Invoices list — Batch E: status filter", () => {
  it("adds a validated status to the where clause", async () => {
    await InvoicesPage({ searchParams: { status: "PAID" } });
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, status: "PAID" } })
    );
  });

  it("ignores an invalid/unknown status value instead of passing it to Prisma", async () => {
    await InvoicesPage({ searchParams: { status: "NOT_A_REAL_STATUS" } });
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID } })
    );
  });
});

describe("Invoices list — Batch E: client filter", () => {
  it("adds clientId to the where clause, ANDed with firmId (not a separate unscoped query)", async () => {
    await InvoicesPage({ searchParams: { clientId: "client_1" } });
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, clientId: "client_1" } })
    );
  });

  it("a cross-firm clientId is still ANDed with this session's firmId — structurally can never match another firm's row", async () => {
    await InvoicesPage({ searchParams: { clientId: "someone_elses_client" } });
    const [{ where }] = mockInvoiceFindMany.mock.calls[0];
    expect(where.firmId).toBe(FIRM_ID);
    expect(where.clientId).toBe("someone_elses_client");
  });

  it("a nonexistent/cross-firm client yields the filtered empty state, not the generic one", async () => {
    mockInvoiceFindMany.mockResolvedValue([]);
    const tree = await InvoicesPage({ searchParams: { clientId: "someone_elses_client" } });
    expect(textOf(tree)).toContain("No invoices match the selected filters.");
    expect(textOf(tree)).not.toContain("No invoices yet.");
  });

  it("the client dropdown options come from a firm-scoped client query, not from scanning invoices", async () => {
    await InvoicesPage({ searchParams: {} });
    expect(mockClientFindMany).toHaveBeenCalledWith({ where: { firmId: FIRM_ID }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  });
});

describe("Invoices list — Batch E: status + client combined", () => {
  it("both filters land in the same where clause together", async () => {
    await InvoicesPage({ searchParams: { status: "OVERDUE", clientId: "client_1" } });
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firmId: FIRM_ID, status: "OVERDUE", clientId: "client_1" } })
    );
  });
});

describe("Invoices list — Batch E: ordering/pagination preserved", () => {
  it("orderBy createdAt desc is unchanged regardless of which filters are active", async () => {
    await InvoicesPage({ searchParams: { status: "PAID", clientId: "client_1" } });
    const [{ orderBy }] = mockInvoiceFindMany.mock.calls[0];
    expect(orderBy).toEqual({ createdAt: "desc" });
  });

  it("only one invoice query and one client query run — no N+1 regardless of result size", async () => {
    mockInvoiceFindMany.mockResolvedValue([INVOICE_FIXTURE, { ...INVOICE_FIXTURE, id: "inv_2" }, { ...INVOICE_FIXTURE, id: "inv_3" }]);
    await InvoicesPage({ searchParams: {} });
    expect(mockInvoiceFindMany).toHaveBeenCalledTimes(1);
    expect(mockClientFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("Invoices list — Batch E: filter bar rendering", () => {
  it("renders ListFilterBar with the full InvoiceStatus enum and the firm's own clients", async () => {
    const tree = await InvoicesPage({ searchParams: {} });
    const bars = findAllByType(tree, ListFilterBar);
    expect(bars).toHaveLength(1);
    expect(bars[0].props.statusOptions).toEqual(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]);
    expect(bars[0].props.clients).toEqual([{ id: "client_1", name: "Acme Pvt Ltd" }]);
  });
});
