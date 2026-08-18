// Canonical navigation config — the ONLY navigation in the app (see
// src/app/dashboard/layout.tsx). Rendered by src/components/SidebarNav.tsx;
// src/lib/navLogic.ts holds the pure filtering/active-detection functions,
// tested in src/lib/navLogic.test.ts.
//
// This started as a feature-flagged opt-in beta sitting alongside a separate
// flat legacy nav (NAV_LEGACY in layout.tsx), toggled by a cookie. The V1
// navigation finalization removed that legacy branch and the cookie-toggle
// machinery entirely (navPreference.ts / navActions.ts /
// navPreferenceConstants.ts, all deleted) once this became canonical — per
// "never create a second navigation architecture," a dormant second nav is
// still a second nav. The decisions below, made during the original design,
// still hold and are the reason the structure looks the way it does:
//
// DECISION 1 — Grouping philosophy: Review Queue wins over Documents & Reconciliation.
//   Tested both structures against: "10 unresolved reconciliation exceptions +
//   3 pending agent proposals — which structure gets a staff member there in one
//   glance?" Grouping Reconciliation by data lineage (with Documents) fails that
//   test outright: it splits two structurally identical things — bounded queues
//   of items a human must approve/resolve/ignore — across two unrelated
//   categories (Documents, and Work-via-Agent-Review), so seeing "everything I
//   need to clear today" requires opening two different menus and adding two
//   numbers in your head. A workflow-shaped category (Review Queue: Reconciliation
//   Exceptions + Agent Proposals) puts both counts one click away from each
//   other. Chose Review Queue. This does split "Reconciliation" itself: the
//   exceptions/triage view moves to Review Queue, while Documents keeps
//   everything that's static reference data (the Documents vault itself). Since
//   there's no runs-list/upload UI built yet (Phase 6 was explicitly deferred in
//   the reconciliation engine work), Documents doesn't gain a new leaf item from
//   this split today — only Review Queue does. Review Queue is deliberately
//   built to extend without a nav redesign: any future "needs a human" item
//   (AI approval, overdue escalation, payment exception, document
//   verification) is just another NavLeaf added to this one category.
//   Net effect on category count: this uses a 7th category if Insights stays
//   standalone, so Insights (just "Reports") folds into Firm Operations as a
//   leaf instead of staying a top-level category — it was always closest in
//   kind to Firm Ops (revenue/oversight data) anyway, and folding it keeps the
//   count at 6, matching the earlier report's ceiling.
//
// DECISION 2 — see prisma/schema.prisma + the 20260812150000 migration
//   (Lead.convertedClientId, NotificationLog.clientId/sourceTaskId,
//   AuditLog.targetEntityType). Shipped as its own migration, ahead of this file.
//
// DECISION 3 — see SidebarNav.tsx / SidebarNav's mobile drawer behavior.
//
// DECISION 4 — Reports lives in Firm Operations but is NOT role-restricted at
//   the nav level, unlike its siblings (Staff/Notifications/Audit
//   Log/Subscription/Settings, all PARTNER+MANAGER only). STAFF sees "Firm
//   Operations" in the sidebar with only "Reports" inside it — everything else
//   in that category is filtered out for them. The actual scoping (STAFF sees
//   only their own task metrics, never firm revenue) is enforced in
//   src/app/dashboard/reports/page.tsx as a query-level filter, not here — nav
//   visibility and data scoping are two separate concerns and both matter, and
//   neither is a security boundary on its own: the real enforcement is each
//   API route's own authorization check, unchanged by any of this.
//
// DECISION 5 (superseded) — this file used to be inert behind a cookie; it is
//   now unconditional. See src/app/dashboard/layout.tsx.

import type { Role } from "@prisma/client";

export type NavLeaf = {
  href: string;
  label: string;
  roles?: Role[]; // omitted = visible to every role
};

export type NavCategory = {
  label: string;
  roles?: Role[]; // omitted = category itself imposes no restriction (children may still be filtered)
  children: NavLeaf[];
};

export type NavNode = NavLeaf | NavCategory;

export function isCategory(node: NavNode): node is NavCategory {
  return "children" in node;
}

/** Rendered outside/above the categorized accordion — the app's front door, not an entity. */
export const HOME_ITEM: NavLeaf = { href: "/dashboard", label: "Overview" };

/** The one category that should default to expanded — see Decision-driven §6 of the earlier report: Task status changes are the single most common action in this app, so Work must never cost an extra click to reach. */
export const ALWAYS_EXPANDED_CATEGORY = "Work";

export const NAV: NavCategory[] = [
  {
    label: "Work",
    children: [
      { href: "/dashboard/tasks", label: "Tasks" },
      { href: "/dashboard/calendar", label: "Compliance Calendar" },
      { href: "/dashboard/tasks/templates", label: "Task Templates" },
    ],
  },
  {
    label: "Review Queue",
    children: [
      { href: "/dashboard/reconciliation", label: "Reconciliation Exceptions" },
      { href: "/dashboard/agent-review", label: "Agent Proposals" },
    ],
  },
  {
    label: "Clients",
    children: [
      { href: "/dashboard/clients", label: "Clients" },
      { href: "/dashboard/leads", label: "Leads" },
    ],
  },
  {
    label: "Money",
    children: [
      { href: "/dashboard/invoices", label: "Invoices" },
      { href: "/dashboard/quotations", label: "Quotations" },
    ],
  },
  {
    label: "Documents",
    children: [{ href: "/dashboard/documents", label: "Documents" }],
  },
  {
    label: "Firm Operations",
    children: [
      { href: "/dashboard/staff", label: "Staff", roles: ["PARTNER", "MANAGER"] },
      { href: "/dashboard/notifications", label: "Notifications", roles: ["PARTNER", "MANAGER"] },
      { href: "/dashboard/audit-log", label: "Audit Log", roles: ["PARTNER", "MANAGER"] },
      { href: "/dashboard/billing", label: "Subscription", roles: ["PARTNER"] },
      { href: "/dashboard/settings", label: "Settings", roles: ["PARTNER", "MANAGER"] },
      { href: "/dashboard/reports", label: "Reports" }, // no roles: STAFF sees this, scoped at the page/query level — Decision 4
    ],
  },
];
