// Pure functions extracted out of SidebarNav.tsx so they're testable without
// rendering React (no jsdom/RTL dependency needed — see navLogic.test.ts).

import type { Role } from "@prisma/client";
import type { NavCategory, NavLeaf } from "./nav";

/**
 * Filters categories and their children by role, then drops any category left
 * with zero visible children — an item with `roles` omitted is visible to
 * everyone. A category's own `roles` (if set) gates the whole category before
 * its children are even considered; today no category in NAV sets one (see
 * Decision 4's comment in nav.ts for why Firm Operations deliberately does
 * NOT set a category-level restriction), but the mechanism supports it for
 * whenever a future category needs it.
 */
export function visibleFor(categories: NavCategory[], role: Role): NavCategory[] {
  return categories
    .filter((category) => !category.roles || category.roles.includes(role))
    .map((category) => ({
      ...category,
      children: category.children.filter((leaf) => !leaf.roles || leaf.roles.includes(role)),
    }))
    .filter((category) => category.children.length > 0);
}

function leafMatchesPath(leaf: NavLeaf, pathname: string): boolean {
  return pathname === leaf.href || pathname.startsWith(`${leaf.href}/`);
}

/**
 * Which category contains the leaf whose href best matches the current
 * pathname — "best" meaning longest/most-specific href, so e.g.
 * "/dashboard/tasks/templates" resolves against the Task Templates leaf
 * rather than the broader Tasks leaf. Returns null if nothing matches
 * (e.g. on the Home page, which sits outside every category).
 */
export function activeCategoryLabel(categories: NavCategory[], pathname: string): string | null {
  let best: { categoryLabel: string; hrefLength: number } | null = null;
  for (const category of categories) {
    for (const leaf of category.children) {
      if (!leafMatchesPath(leaf, pathname)) continue;
      if (!best || leaf.href.length > best.hrefLength) {
        best = { categoryLabel: category.label, hrefLength: leaf.href.length };
      }
    }
  }
  return best?.categoryLabel ?? null;
}

/**
 * Which categories should render expanded: the active one (wherever the user
 * currently is), the always-expanded one (Work — see nav.ts), and any the
 * user has manually toggled open. Manual toggles and the active category are
 * independent, so collapsing Work manually while standing inside it should
 * still show it expanded (active-category wins) — the caller (SidebarNav)
 * only calls this to compute the *initial* set; manual toggles after that are
 * plain component state.
 */
export function initialExpandedCategories(params: {
  categories: NavCategory[];
  pathname: string;
  alwaysExpandedCategory: string;
}): Set<string> {
  const expanded = new Set<string>([params.alwaysExpandedCategory]);
  const active = activeCategoryLabel(params.categories, params.pathname);
  if (active) expanded.add(active);
  return expanded;
}
