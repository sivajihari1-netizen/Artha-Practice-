import { describe, expect, it } from "vitest";
import { getCreateMenuItems } from "./homeCreateMenu";

describe("getCreateMenuItems", () => {
  it("PARTNER (canCreateFinancial:true, canAddStaff:true) sees all 6 items, including Add Staff", () => {
    const items = getCreateMenuItems(true, true);
    const titles = items.map((i) => i.title);
    expect(titles).toEqual(["New Task", "Add Client", "Add Lead", "New Invoice", "New Quotation", "Add Staff"]);
  });

  it("MANAGER (canCreateFinancial:true, canAddStaff:false) sees invoices/quotations but not Add Staff", () => {
    const items = getCreateMenuItems(true, false);
    const titles = items.map((i) => i.title);
    expect(titles).toContain("New Invoice");
    expect(titles).toContain("New Quotation");
    expect(titles).not.toContain("Add Staff");
  });

  it("STAFF (canCreateFinancial:false, canAddStaff:false) sees only the 3 unrestricted actions", () => {
    const items = getCreateMenuItems(false, false);
    const titles = items.map((i) => i.title);
    expect(titles).toEqual(["New Task", "Add Client", "Add Lead"]);
  });

  it("every item destination is a real, existing route (no invented creation flow)", () => {
    const items = getCreateMenuItems(true, true);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toEqual([
      "/dashboard/tasks",
      "/dashboard/clients",
      "/dashboard/leads",
      "/dashboard/invoices/new",
      "/dashboard/quotations/new",
      "/dashboard/staff",
    ]);
  });
});
