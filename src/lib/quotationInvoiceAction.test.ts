import { describe, expect, it } from "vitest";
import { resolveQuotationInvoiceAction } from "./quotationInvoiceAction";

describe("resolveQuotationInvoiceAction — Quotation -> Invoice button state (P1 batch)", () => {
  it("ACCEPTED + real client + no invoice yet -> 'create'", () => {
    expect(resolveQuotationInvoiceAction("ACCEPTED", "client_1", null)).toBe("create");
  });

  it("ACCEPTED + real client + invoice already linked -> 'view'", () => {
    expect(resolveQuotationInvoiceAction("ACCEPTED", "client_1", "inv_1")).toBe("view");
  });

  it("ACCEPTED + prospect quotation (clientId null) -> 'none', even with no invoice", () => {
    expect(resolveQuotationInvoiceAction("ACCEPTED", null, null)).toBe("none");
  });

  it("a prospect quotation never shows 'view' either, even if somehow linked", () => {
    expect(resolveQuotationInvoiceAction("ACCEPTED", null, "inv_1")).toBe("none");
  });

  it.each(["DRAFT", "SENT", "DECLINED", "EXPIRED"])("%s status -> 'none', regardless of client/invoice state", (status) => {
    expect(resolveQuotationInvoiceAction(status, "client_1", null)).toBe("none");
    expect(resolveQuotationInvoiceAction(status, "client_1", "inv_1")).toBe("none");
  });
});
