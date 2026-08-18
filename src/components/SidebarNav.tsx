"use client";

// The one new client-side piece introduced by the IA restructure (per the
// brief's step 5) — DashboardLayout stays a server component. Two things
// need client state here and can't be done with the old CSS-only checkbox
// trick: (1) auto-expanding the category containing the current route, which
// needs usePathname(); (2) a real slide-over drawer on mobile (Decision 3)
// that closes on backdrop click or on navigation, which needs JS regardless.
//
// Desktop and mobile intentionally do NOT share a layout, only shared state
// logic (navLogic.ts) — see Decision 3. Desktop is a permanent column;
// mobile is a fixed-position drawer + backdrop, closed by default, opened by
// a real button (not a hidden checkbox), and both start from the same
// "Work + active category only" expansion, never all six categories open.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import { HOME_ITEM, ALWAYS_EXPANDED_CATEGORY, type NavCategory } from "@/lib/nav";
import { activeCategoryLabel, initialExpandedCategories } from "@/lib/navLogic";

function isLeafActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SidebarNav({
  categories,
  firmName,
  userEmail,
  isSuperAdmin,
}: {
  categories: NavCategory[]; // already role-filtered server-side via visibleFor() — see DashboardLayout
  firmName: string;
  userEmail: string;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialExpandedCategories({ categories, pathname, alwaysExpandedCategory: ALWAYS_EXPANDED_CATEGORY })
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Re-sync on route change: open whichever category the user navigated into
  // (even if they'd previously collapsed it), and always close the mobile
  // drawer so clicking a link doesn't leave the overlay covering the page.
  useEffect(() => {
    const active = activeCategoryLabel(categories, pathname);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(ALWAYS_EXPANDED_CATEGORY);
      if (active) next.add(active);
      return next;
    });
    setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleCategory(label: string) {
    if (label === ALWAYS_EXPANDED_CATEGORY) return; // Work can't be collapsed — the always-visible-Kanban decision
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const panel = (
    <>
      <div className="px-5 py-5 border-b border-line">
        <div className="text-xl font-extrabold">
          Artha<span className="text-accent">.</span>
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">{firmName}</div>
        {/* Reserved slot for the future global Search / Command Center (see
            Part 20 of the IA audit) — intentionally disabled, no backend
            exists yet. This establishes where it will live without building
            it: a client name, GSTIN, task, or invoice number search. */}
        <button
          type="button"
          disabled
          title="Search — coming soon"
          className="mt-3 w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md border border-line text-xs text-gray-400 cursor-not-allowed"
        >
          <span aria-hidden="true">🔍</span>
          <span>Search…</span>
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Link
          href={HOME_ITEM.href}
          className={`block px-3 py-2 rounded-md text-sm font-medium hover:bg-paper-dim ${
            pathname === HOME_ITEM.href ? "bg-paper-dim text-accent" : "text-charcoal"
          }`}
        >
          {HOME_ITEM.label}
        </Link>

        {categories.map((category) => {
          const isOpen = expanded.has(category.label);
          const isAlwaysExpanded = category.label === ALWAYS_EXPANDED_CATEGORY;
          return (
            <div key={category.label} className="pt-2">
              <button
                type="button"
                onClick={() => toggleCategory(category.label)}
                disabled={isAlwaysExpanded}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 disabled:cursor-default"
              >
                <span>{category.label}</span>
                {!isAlwaysExpanded && <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>}
              </button>
              {isOpen && (
                <div className="space-y-1">
                  {category.children.map((leaf) => (
                    <Link
                      key={leaf.href}
                      href={leaf.href}
                      className={`block px-3 py-2 rounded-md text-sm font-medium hover:bg-paper-dim ${
                        isLeafActive(pathname, leaf.href) ? "bg-paper-dim text-accent" : "text-charcoal"
                      }`}
                    >
                      {leaf.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isSuperAdmin && (
          <Link href="/admin" className="block px-3 py-2 rounded-md text-sm font-medium text-accent hover:bg-accent-light mt-2">
            Platform Admin
          </Link>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-line text-xs text-gray-500">
        <div className="mb-2">{userEmail}</div>
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — a real button driving React state, not the old CSS-checkbox toggle. */}
      <div className="print:hidden md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-white sticky top-0 z-20">
        <div className="text-lg font-extrabold">
          Artha<span className="text-accent">.</span>
          <span className="text-xs font-normal text-gray-500 ml-2">{firmName}</span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="cursor-pointer border border-line rounded-md px-3 py-1.5 text-sm font-medium"
        >
          Menu
        </button>
      </div>

      {/* Mobile drawer (Decision 3): slide-over + backdrop, not a permanently visible column. */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col h-full shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 text-gray-400 text-sm"
            >
              ✕
            </button>
            {panel}
          </aside>
        </div>
      )}

      {/* Desktop: permanent column, unaffected by drawerOpen. */}
      <aside className="print:hidden hidden md:flex flex-col w-60 shrink-0 border-r border-line bg-white">{panel}</aside>
    </>
  );
}
