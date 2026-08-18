"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp, Eyebrow, Panel, Reveal, Section, Spotlight, Tag, usePrefersReducedMotion } from "./primitives";

// Ported from the Lovable reference (Artha Practice Hub (2)) — this file
// exists only in V2, not V1. Exports `CaseStudy` and `CommandDemo`, both
// genuinely rendered in V2's Index() (CommandDemo between Reconciliation
// and Advanced; CaseStudy between SocialProof and OutcomeBand).

/* ---------------- Case study ---------------- */

const METRICS = [
  { label: "Follow-up hours / week", before: 14, after: 4, suffix: "h" },
  { label: "Filings missed / quarter", before: 6, after: 0, suffix: "" },
  { label: "Recon exceptions cleared same day", before: 35, after: 92, suffix: "%" },
  { label: "Invoices overdue > 30 days", before: 21, after: 6, suffix: "" },
];

export function CaseStudy() {
  return (
    <Section>
      <Eyebrow>Case study</Eyebrow>
      <h2 className="font-mkt-display max-w-[22ch] text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
        A 9-person Visakhapatnam practice, one quarter after switching.
      </h2>

      <div className="mt-9 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-mkt-border bg-mkt-border sm:grid-cols-2">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 70}>
              <div className="h-full bg-mkt-surface p-5">
                <p className="text-[11.5px] text-mkt-fg-muted">{m.label}</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="mkt-num text-[15px] text-mkt-fg-muted line-through">
                    {m.before}
                    {m.suffix}
                  </span>
                  <span className="font-mkt-display text-[30px] leading-none font-semibold text-mkt-primary">
                    <CountUp to={m.after} suffix={m.suffix} />
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Spotlight className="flex flex-col justify-between p-6">
          <div>
            <Tag tone="accent">K Bhanu Teja and Associates</Tag>
            <p className="mt-4 text-[15.5px] leading-relaxed text-mkt-fg-2">
              &ldquo;We stopped running the practice out of WhatsApp. Every GSTR-2B exception now
              becomes a task with an owner and a date — nobody has to remember anything.&rdquo;
            </p>
          </div>
          <div className="mt-6 border-t border-mkt-border pt-5">
            <p className="text-[13px] font-medium text-mkt-fg">CA K. Bhanu Teja</p>
            <p className="text-[11.5px] text-mkt-fg-muted">Partner · Visakhapatnam · 9 staff · 240+ clients</p>
          </div>
        </Spotlight>
      </div>
    </Section>
  );
}

/* ---------------- Command palette demo ---------------- */

type Item = { group: string; label: string; hint: string };

const ITEMS: Item[] = [
  { group: "Clients", label: "Sri Balaji Traders", hint: "GSTIN 37AABCS…  ·  Client 360" },
  { group: "Clients", label: "Vizag Marine Exports", hint: "GSTIN 37AACVM…  ·  Client 360" },
  { group: "Tasks", label: "GSTR-3B — July filing", hint: "Due in 5 days · Priya S" },
  { group: "Tasks", label: "Review GST mismatch", hint: "High risk · Overdue 2 days" },
  { group: "Invoices", label: "INV-2026-0184", hint: "₹48,000 · Sent" },
  { group: "Invoices", label: "INV-2026-0179", hint: "₹1,20,000 · Overdue" },
  { group: "Documents", label: "Bank statement — Q1", hint: "Requested · reminder sent" },
  { group: "Reconciliation", label: "GSTR-2B vs purchase register", hint: "4 exceptions to review" },
  { group: "Actions", label: "Create recurring task", hint: "Monthly · auto-assign" },
  { group: "Actions", label: "Send document request", hint: "WhatsApp + email" },
  { group: "DSC", label: "DSC register", hint: "2 expiring in 12 days" },
];

const TYPED = ["gst", "invoice", "recon", "dsc"];

export function CommandDemo() {
  const [q, setQ] = useState("");
  const [typedIdx, setTypedIdx] = useState(0);
  const [manual, setManual] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [announce, setAnnounce] = useState("");
  const reduced = usePrefersReducedMotion();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-type a rotating query until the visitor takes over.
  useEffect(() => {
    if (manual || reduced) return;
    const target = TYPED[typedIdx % TYPED.length] ?? "gst";
    let i = 0;
    const type = setInterval(() => {
      i += 1;
      setQ(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(type);
        setTimeout(() => setTypedIdx((n) => n + 1), 1600);
      }
    }, 110);
    return () => clearInterval(type);
  }, [typedIdx, manual, reduced]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ITEMS.slice(0, 6);
    return ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(s) ||
        it.group.toLowerCase().includes(s) ||
        it.hint.toLowerCase().includes(s),
    ).slice(0, 6);
  }, [q]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  const takeOver = () => {
    setManual(true);
    setQ("");
    inputRef.current?.focus();
  };

  // Real Cmd/Ctrl+K shortcut: hands the demo search to the keyboard user.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        takeOver();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reduced]);

  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow>Search everything</Eyebrow>
          <h2 className="font-mkt-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
            One keystroke to any client, task, invoice or exception.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[14.5px] text-mkt-fg-muted">
            Artha indexes the whole practice. Hit{" "}
            <kbd className="rounded border border-mkt-border-hi bg-mkt-surface-2 px-1.5 py-0.5 text-[11px] text-mkt-fg">
              Ctrl
            </kbd>{" "}
            <kbd className="rounded border border-mkt-border-hi bg-mkt-surface-2 px-1.5 py-0.5 text-[11px] text-mkt-fg">
              K
            </kbd>{" "}
            and jump straight to the record — no menu hunting, no tab archaeology.
          </p>
          <button
            type="button"
            onClick={takeOver}
            className="mt-6 text-[13.5px] font-medium text-mkt-primary hover:underline"
          >
            Try the search yourself <ArrowUpRight aria-hidden className="ml-0.5 inline size-3.5" />
          </button>
        </div>

        <Panel className="overflow-hidden p-0 shadow-[var(--mkt-shadow-elegant)]">
          <div className="flex items-center gap-2.5 border-b border-mkt-border px-4 py-3">
            <Search aria-hidden className="size-4 shrink-0 text-mkt-fg-muted" />
            <input
              ref={inputRef}
              value={q}
              type="text"
              role="combobox"
              aria-label="Search the Artha demo — clients, tasks, invoices"
              aria-expanded
              aria-controls="artha-command-results"
              aria-activedescendant={results[cursor] ? `artha-cmd-${cursor}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              placeholder="Search clients, tasks, invoices…"
              onChange={(e) => {
                setManual(true);
                setQ(e.target.value);
              }}
              onFocus={() => setManual(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => (results.length ? (c + 1) % results.length : 0));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const r = results[cursor];
                  if (r) setAnnounce(`Opening ${r.label} in ${r.group}`);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setQ("");
                  setAnnounce("Search cleared");
                }
              }}
              className="w-full bg-transparent text-[14px] text-mkt-fg outline-none placeholder:text-mkt-fg-muted"
            />
            {!manual && !reduced && <span className="h-4 w-px animate-pulse bg-mkt-primary" />}
            <kbd className="hidden rounded border border-mkt-border-hi bg-mkt-surface-2 px-1.5 py-0.5 text-[10.5px] text-mkt-fg-muted sm:inline">
              esc
            </kbd>
          </div>
          <div id="artha-command-results" role="listbox" aria-label="Search results" className="min-h-[268px] p-2">
            {results.length === 0 ? (
              <p className="p-6 text-center text-[13px] text-mkt-fg-muted">No matches — try &ldquo;gst&rdquo;.</p>
            ) : (
              results.map((r, i) => (
                <div
                  key={r.group + r.label}
                  id={`artha-cmd-${i}`}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors",
                    i === cursor ? "bg-[var(--mkt-wash)] ring-1 ring-mkt-primary/40" : "hover:bg-mkt-surface-2",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] text-mkt-fg-2">{r.label}</span>
                    <span className="mkt-num block truncate text-[11px] text-mkt-fg-muted">{r.hint}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Tag>{r.group}</Tag>
                    {i === cursor && <CornerDownLeft aria-hidden className="size-3.5 text-mkt-primary" />}
                  </span>
                </div>
              ))
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {announce || `${results.length} results`}
          </p>
        </Panel>
      </div>
    </Section>
  );
}
