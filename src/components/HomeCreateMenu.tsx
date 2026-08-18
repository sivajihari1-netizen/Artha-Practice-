"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getCreateMenuItems } from "@/lib/homeCreateMenu";

// H1 Home — the one genuinely interactive piece of the Home page, so it's
// the only new "use client" component; everything else on Home is a plain
// Server Component (matching Reports/Staff's own single-file convention).
// Every destination is an existing route with an existing creation form
// already living there — this menu never opens a new creation flow, it
// only navigates. New Task/Add Client/Add Lead land on their module's list
// page (where the existing inline form is one click away via its own
// toggle) since none of those forms support a query-param auto-open today;
// only Invoice/Quotation have a dedicated /new route to land on directly.
// The item list itself (and its role rules) lives in src/lib/homeCreateMenu.ts
// so it's unit-testable without needing to render this hook-bearing component.
export default function HomeCreateMenu({ canCreateFinancial, canAddStaff }: { canCreateFinancial: boolean; canAddStaff: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const items = getCreateMenuItems(canCreateFinancial, canAddStaff);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    function onDocClick(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  // Tabbing (as opposed to Arrow-key navigating) moves focus through the
  // whole page's tab order, not just this menu's items — without this, a
  // keyboard user tabbing past the last item leaves the popup visibly open
  // while focus has already moved elsewhere on the page. `relatedTarget` is
  // the element about to receive focus; close only when it's truly outside
  // both the trigger and the menu.
  function onWrapperBlur(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && (menuRef.current?.contains(next) || triggerRef.current?.contains(next))) return;
    setOpen(false);
  }

  function onItemKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemRefs.current[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemRefs.current[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative" onBlur={onWrapperBlur}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="home-create-menu"
        className="inline-flex items-center gap-2 bg-accent text-white rounded-md px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        + Create
        <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id="home-create-menu"
          role="menu"
          aria-label="Create new"
          className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white border border-line rounded-xl shadow-md p-1.5 z-20"
        >
          {items.map((item, i) => (
            <Link
              key={item.href + item.title}
              ref={(el) => { itemRefs.current[i] = el; }}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              onKeyDown={(e) => onItemKeyDown(e, i)}
              className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-charcoal hover:bg-paper-dim focus-visible:bg-paper-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <span className="w-5 text-center text-accent text-sm mt-0.5 shrink-0" aria-hidden="true">{item.icon}</span>
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold">{item.title}</span>
                <span className="text-[11px] text-gray-400 mt-0.5">{item.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
