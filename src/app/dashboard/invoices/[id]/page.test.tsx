import { describe, expect, it, vi } from "vitest";

// InvoiceDocument imports src/lib/fonts.ts, which calls next/font/google at
// module scope — a real Next.js build-time compiler feature that isn't a
// callable function outside the actual Next.js pipeline. Mocked here only
// (not in src/lib/fonts.ts itself) so this pre-existing, unrelated
// incompatibility doesn't block testing the Batch B link this page needed.
vi.mock("next/font/google", () => ({ Inter: () => ({ className: "font-inter-mock", style: {} }) }));

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockInvoiceFindFirst = vi.fn();
const mockInvoiceUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a),
      update: (...a: unknown[]) => mockInvoiceUpdate(...a),
    },
  },
}));

vi.mock("@/lib/invoicePayment", () => ({ ensureInvoicePaymentLink: vi.fn().mockResolvedValue(null) }));

import InvoiceDetailPage from "./page";

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

const INVOICE_FIXTURE = {
  id: "inv_1",
  invoiceNumber: "INV/2026-27/0001",
  status: "DRAFT",
  publicToken: "tok_abc",
  issueDate: new Date("2026-07-01"),
  dueDate: null,
  paymentTerms: null,
  notes: null,
  discountType: null,
  discountValue: 0,
  discountAmount: 0,
  applyGst: false,
  gstType: null,
  gstRate: 18,
  subtotal: 1000,
  taxAmount: 0,
  total: 1000,
  paidAt: null,
  paymentRef: null,
  items: [],
  client: { id: "client_1", name: "Acme Pvt Ltd", gstin: null, pan: null, contacts: [] },
  firm: { name: "Test Firm", upiId: null, razorpayKeyId: null },
};

describe("Invoice detail page — Batch B item 1: Client name links to Client 360", () => {
  it("wraps the client name in a link to /dashboard/clients/[clientId]", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockInvoiceFindFirst.mockResolvedValue(INVOICE_FIXTURE);

    const tree = await InvoiceDetailPage({ params: { id: "inv_1" } });
    const links = findAllByProp(tree, "href").filter((el) => el.props.href === "/dashboard/clients/client_1");
    expect(links.length).toBeGreaterThan(0);
  });

  it("the invoice lookup stays firm-scoped — never trusts a browser-supplied firmId", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockInvoiceFindFirst.mockResolvedValue(INVOICE_FIXTURE);
    await InvoiceDetailPage({ params: { id: "inv_1" } });
    expect(mockInvoiceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inv_1", firmId: "firm_1" } }));
  });
});
