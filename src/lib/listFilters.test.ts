import { describe, expect, it } from "vitest";
import { buildFilterUrl, buildFilterUrlResettingPage, buildPageUrl } from "./listFilters";

describe("buildFilterUrl", () => {
  it("sets a new param when none exist", () => {
    expect(buildFilterUrl("/dashboard/invoices", new URLSearchParams(), "status", "PAID")).toBe(
      "/dashboard/invoices?status=PAID"
    );
  });

  it("removes the param entirely when value is empty (the 'All' option)", () => {
    expect(buildFilterUrl("/dashboard/invoices", new URLSearchParams("status=PAID"), "status", "")).toBe(
      "/dashboard/invoices"
    );
  });

  it("preserves other existing params when changing one", () => {
    const url = buildFilterUrl("/dashboard/invoices", new URLSearchParams("status=PAID&clientId=c1"), "clientId", "c2");
    expect(url).toBe("/dashboard/invoices?status=PAID&clientId=c2");
  });

  it("composes status + client into the same URL across two calls", () => {
    const afterStatus = buildFilterUrl("/dashboard/quotations", new URLSearchParams(), "status", "SENT");
    const params = new URLSearchParams(afterStatus.split("?")[1]);
    const afterClient = buildFilterUrl("/dashboard/quotations", params, "clientId", "c1");
    expect(afterClient).toBe("/dashboard/quotations?status=SENT&clientId=c1");
  });

  it("drops back to a bare pathname (no trailing '?') once the last param is cleared", () => {
    expect(buildFilterUrl("/dashboard/quotations", new URLSearchParams("clientId=c1"), "clientId", "")).toBe(
      "/dashboard/quotations"
    );
  });
});

describe("buildFilterUrlResettingPage", () => {
  it("sets the filter and strips an existing page param in the same call", () => {
    const url = buildFilterUrlResettingPage(
      "/dashboard/reconciliation",
      new URLSearchParams("clientId=c1&page=3"),
      "reason",
      "AMOUNT_MISMATCH"
    );
    expect(url).toBe("/dashboard/reconciliation?clientId=c1&reason=AMOUNT_MISMATCH");
  });

  it("clearing a filter also strips page, even if page was the only other param", () => {
    const url = buildFilterUrlResettingPage("/dashboard/reconciliation", new URLSearchParams("reason=DUPLICATE&page=2"), "reason", "");
    expect(url).toBe("/dashboard/reconciliation");
  });

  it("preserves other filters untouched while resetting page", () => {
    const url = buildFilterUrlResettingPage(
      "/dashboard/reconciliation",
      new URLSearchParams("clientId=c1&type=BANK_VS_BOOKS&page=5"),
      "type",
      "GST_2B_VS_PURCHASE"
    );
    expect(url).toBe("/dashboard/reconciliation?clientId=c1&type=GST_2B_VS_PURCHASE");
  });
});

describe("buildPageUrl", () => {
  it("omits the page param entirely for page 1 (keeps the URL clean)", () => {
    expect(buildPageUrl("/dashboard/reconciliation", new URLSearchParams("clientId=c1&page=2"), 1)).toBe(
      "/dashboard/reconciliation?clientId=c1"
    );
  });

  it("sets page for page > 1, preserving other filters", () => {
    expect(buildPageUrl("/dashboard/reconciliation", new URLSearchParams("clientId=c1"), 3)).toBe(
      "/dashboard/reconciliation?clientId=c1&page=3"
    );
  });
});
