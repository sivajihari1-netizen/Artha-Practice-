"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn } from "./primitives";

// Adapted from the Lovable reference (Artha Practice Hub (2)): dropdown
// items point at real in-page sections that exist on this page (not
// fabricated pages). Log in / Start Free Trial now wired to the real
// /login and /signup routes — the source had no routes at all behind
// these buttons.
//
// One approved deviation from the V2 source (explicitly authorized): V2's
// desktop <nav> is still `hidden md:flex` with no mobile equivalent at all —
// below 768px there is no way to reach any of these links except manual
// scrolling. A hamburger + mobile panel was added here to fix that; kept as
// the only navigation deviation from V2. Everything else below (Escape
// returns focus to its trigger, aria-expanded/aria-controls/aria-haspopup,
// onFocus opens the menu, ArrowDown moves focus into it, blur-to-close) is
// V2's actual accessibility implementation, ported as-is.
const PRODUCT = [
  ["Practice Management", "Manage clients, tasks & compliance"],
  ["Client Management", "Everything about a client in one place"],
  ["Tasks & Compliance", "Deadlines, recurring work & workload"],
  ["Documents", "Requests, collection & tracking"],
  ["Billing", "Quotations, invoices & payments"],
  ["Reconciliation", "GST reconciliation & exceptions"],
];

const PRODUCT_ANCHORS = ["#product", "#product", "#product", "#product", "#pricing", "#reconciliation"];

const RESOURCES = [
  ["How it works", "The chain from client to resolved"],
  ["FAQ", "Trial, teams, data and upgrades"],
  ["Pricing", "Plans from ₹1,000 / year"],
];

const RESOURCE_ANCHORS = ["#connected", "#faq", "#pricing"];

const MOBILE_LINKS = [
  ["Product", "#product"],
  ["How it works", "#connected"],
  ["Security", "#security"],
  ["Pricing", "#pricing"],
  ["Resources", "#faq"],
  ["About", "#footer"],
];

export function Nav({ onWatch }: { onWatch: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes any open mega-menu and returns focus to its trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const trigger = headerRef.current?.querySelector<HTMLButtonElement>(`[data-menu-trigger="${open}"]`);
      setOpen(null);
      trigger?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      ref={headerRef}
      onMouseLeave={() => setOpen(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
      }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300",
        scrolled ? "border-mkt-border bg-mkt-bg/85 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1180px] items-center gap-6 px-5 transition-all duration-300",
          scrolled ? "h-14" : "h-16",
        )}
      >
        <a href="#top" className="font-mkt-display text-[18px] font-semibold tracking-[-0.04em] text-mkt-fg">
          Artha<span className="text-mkt-primary">.</span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-1 text-[13.5px] md:flex">
          <Trigger
            id="product"
            label="Product"
            open={open === "product"}
            onOpen={() => setOpen("product")}
            onToggle={() => setOpen((o) => (o === "product" ? null : "product"))}
          />
          <NavLink href="#connected">How it works</NavLink>
          <NavLink href="#security">Security</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
          <Trigger
            id="resources"
            label="Resources"
            open={open === "resources"}
            onOpen={() => setOpen("resources")}
            onToggle={() => setOpen((o) => (o === "resources" ? null : "resources"))}
          />
          <NavLink href="#footer">About</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Btn variant="quiet" size="sm" onClick={onWatch} className="hidden sm:inline-flex">
            Watch Artha
          </Btn>
          <Btn variant="ghost" size="sm" href="/login" className="hidden sm:inline-flex">
            Log in
          </Btn>
          <Btn size="sm" href="/signup">
            Start 30-Day Free Trial
          </Btn>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-mkt-border text-mkt-fg md:hidden"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <Dropdown id="product" open={open === "product"} title="Product" items={PRODUCT} anchors={PRODUCT_ANCHORS} />
      <Dropdown id="resources" open={open === "resources"} title="Resources" items={RESOURCES} anchors={RESOURCE_ANCHORS} />

      {mobileOpen && (
        <div className="border-t border-mkt-border bg-mkt-bg/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-[1180px] flex-col gap-1 px-5 py-4">
            {MOBILE_LINKS.map(([label, href]) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-3 text-[14px] font-medium text-mkt-fg-2 transition-colors hover:bg-mkt-surface hover:text-mkt-fg"
              >
                {label}
              </a>
            ))}
            <Btn
              variant="ghost"
              size="sm"
              href="/login"
              className="mt-2 justify-center sm:hidden"
              onClick={() => setMobileOpen(false)}
            >
              Log in
            </Btn>
          </nav>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-md px-3 py-2 text-mkt-fg-muted transition-colors hover:text-mkt-fg">
      {children}
    </a>
  );
}

function Trigger({
  id,
  label,
  open,
  onOpen,
  onToggle,
}: {
  id: string;
  label: string;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-menu-trigger={id}
      aria-expanded={open}
      aria-controls={`menu-${id}`}
      aria-haspopup="true"
      onMouseEnter={onOpen}
      onFocus={onOpen}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onOpen();
          requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>(`#menu-${id} a`)?.focus());
        }
      }}
      className={cn(
        "flex items-center gap-1 rounded-md px-3 py-2 transition-colors",
        open ? "text-mkt-fg" : "text-mkt-fg-muted hover:text-mkt-fg",
      )}
    >
      {label}
      <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
    </button>
  );
}

function Dropdown({
  id,
  open,
  title,
  items,
  anchors,
}: {
  id: string;
  open: boolean;
  title: string;
  items: string[][];
  anchors: string[];
}) {
  return (
    <div
      id={`menu-${id}`}
      aria-label={title}
      className={cn(
        "hidden overflow-hidden border-mkt-border bg-mkt-bg/95 backdrop-blur-xl transition-all duration-250 md:block",
        open ? "max-h-[420px] border-t opacity-100" : "invisible max-h-0 opacity-0",
      )}
    >
      <div className="mx-auto max-w-[1180px] px-5 py-6">
        <p className="mkt-label-eyebrow mb-4 text-mkt-fg-muted">{title}</p>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([t, d], i) => (
            <a
              key={t}
              href={anchors[i]}
              className="rounded-lg border border-transparent p-3 transition-colors hover:border-mkt-border hover:bg-mkt-surface"
            >
              <p className="text-[13.5px] font-medium text-mkt-fg">{t}</p>
              <p className="text-[12px] text-mkt-fg-muted">{d}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
