// Pure item-list logic behind HomeCreateMenu ("use client", untestable
// directly under plain Vitest — same constraint as every other hook-bearing
// component in this app). Every destination is an existing route; this menu
// never opens a new creation flow.
export type CreateMenuItem = { href: string; title: string; desc: string; icon: string };

const BASE_ITEMS: CreateMenuItem[] = [
  { href: "/dashboard/tasks", title: "New Task", desc: "Assign work, optionally to a client", icon: "✓" },
  { href: "/dashboard/clients", title: "Add Client", desc: "Onboard a new engagement", icon: "◇" },
  { href: "/dashboard/leads", title: "Add Lead", desc: "Track a new prospect", icon: "◎" },
];

// Matches POST /api/invoices and POST /api/quotations, both of which reject
// role === "STAFF" only (PARTNER and MANAGER both allowed).
const FINANCIAL_ITEMS: CreateMenuItem[] = [
  { href: "/dashboard/invoices/new", title: "New Invoice", desc: "Bill a client", icon: "₹" },
  { href: "/dashboard/quotations/new", title: "New Quotation", desc: "Propose a scope of work", icon: "▤" },
];

// Matches POST /api/staff's real gate: role !== "PARTNER" (MANAGER included) is rejected.
const STAFF_ITEM: CreateMenuItem = { href: "/dashboard/staff", title: "Add Staff", desc: "Partner only", icon: "＋" };

export function getCreateMenuItems(canCreateFinancial: boolean, canAddStaff: boolean): CreateMenuItem[] {
  return [...BASE_ITEMS, ...(canCreateFinancial ? FINANCIAL_ITEMS : []), ...(canAddStaff ? [STAFF_ITEM] : [])];
}
