import { describe, expect, it, vi } from "vitest";

// QuotationDocument imports src/lib/fonts.ts, which calls next/font/google at
// module scope — a real Next.js build-time compiler feature, not a callable
// function outside the actual Next.js pipeline. Mocked here only (not in
// src/lib/fonts.ts itself) so this pre-existing, unrelated incompatibility
// doesn't block testing the Batch B link this page needed.
vi.mock("next/font/google", () => ({ Inter: () => ({ className: "font-inter-mock", style: {} }) }));

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockQuotationFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { quotation: { findFirst: (...a: unknown[]) => mockQuotationFindFirst(...a) } },
}));

import QuotationDetailPage from "./page";

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

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

function baseQuotation(overrides: Record<string, unknown> = {}) {
  return {
    id: "quo_1",
    quotationNumber: "QUO/2026-27/0001",
    status: "DRAFT",
    publicToken: "tok_q",
    title: "GST Registration",
    subtitle: null,
    preparedByName: null,
    introNote: null,
    validUntil: null,
    statHighlights: [],
    aboutPoints: [],
    scopeItems: [],
    feeItems: [],
    termsItems: [],
    issueDate: new Date("2026-07-01"),
    acceptedAt: null,
    acceptedByName: null,
    prospectName: null,
    prospectEmail: null,
    prospectPhone: null,
    clientId: "client_1",
    client: { id: "client_1", name: "Acme Pvt Ltd", contacts: [] },
    firm: { name: "Test Firm" },
    createdInvoice: null,
    ...overrides,
  };
}

describe("Quotation detail page — Batch B item 2: Client name links to Client 360", () => {
  it("wraps the client name in a link when the quotation has a real client", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockQuotationFindFirst.mockResolvedValue(baseQuotation());

    const tree = await QuotationDetailPage({ params: { id: "quo_1" } });
    const links = findAllByProp(tree, "href").filter((el) => el.props.href === "/dashboard/clients/client_1");
    expect(links.length).toBeGreaterThan(0);
  });

  it("a prospect-only quotation (clientId null) never renders a broken /dashboard/clients/ link", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockQuotationFindFirst.mockResolvedValue(
      baseQuotation({ clientId: null, client: null, prospectName: "Future Client Co" })
    );

    const tree = await QuotationDetailPage({ params: { id: "quo_1" } });
    const clientLinks = findAllByProp(tree, "href").filter((el) => typeof el.props.href === "string" && el.props.href.startsWith("/dashboard/clients/"));
    expect(clientLinks).toHaveLength(0);
    expect(textOf(tree)).toContain("Future Client Co");
  });

  it("the quotation lookup stays firm-scoped", async () => {
    mockGetSession.mockReturnValue({ userId: "user_1", firmId: "firm_1", role: "PARTNER", email: "p@firm.test" });
    mockQuotationFindFirst.mockResolvedValue(baseQuotation());
    await QuotationDetailPage({ params: { id: "quo_1" } });
    expect(mockQuotationFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "quo_1", firmId: "firm_1" } }));
  });
});
