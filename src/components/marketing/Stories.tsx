"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel, Section, Tag } from "./primitives";

function StoryShell({
  n,
  title,
  body,
  points,
  visual,
  flip,
}: {
  n: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid gap-8 border-t border-mkt-border py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14">
      <div className={cn(flip && "lg:order-2")}>
        <p className="mkt-num mb-3 text-[11px] font-semibold tracking-[0.14em] text-mkt-primary">{n}</p>
        <h3 className="font-mkt-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
          {title}
        </h3>
        <p className="mt-4 text-[14.5px] text-mkt-fg-muted">{body}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[14px] text-mkt-fg-2">
              <Check className="mt-1 size-[15px] shrink-0 text-mkt-primary" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(flip && "lg:order-1")}>{visual}</div>
    </div>
  );
}

const C360_TABS = ["Overview", "Tasks", "Invoices", "Documents", "Reconciliation", "Activity"];

// Exported (not just used internally) so the /product/clients depth page can
// reuse the exact same live visual instead of duplicating it.
export function Client360() {
  const [tab, setTab] = useState("Overview");
  return (
    <Panel className="overflow-hidden shadow-[var(--mkt-shadow-sm-elegant)]">
      <div className="flex items-center gap-3 border-b border-mkt-border p-3.5">
        <span className="grid size-9 place-items-center rounded-lg bg-[var(--mkt-wash-hi)] text-[13px] font-semibold text-mkt-primary">
          KE
        </span>
        <div>
          <p className="font-mkt-display text-[14px] font-semibold text-mkt-fg">Kavya Exports</p>
          <p className="text-[10.5px] text-mkt-fg-muted">Private Limited · Hyderabad</p>
        </div>
        <span className="ml-auto">
          <Tag tone="accent">Active</Tag>
        </span>
      </div>
      <div
        role="tablist"
        aria-label="Client 360 sections"
        className="flex gap-1 overflow-x-auto border-b border-mkt-border px-3.5"
      >
        {C360_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = C360_TABS.indexOf(t);
              const next =
                C360_TABS[(i + (e.key === "ArrowRight" ? 1 : C360_TABS.length - 1)) % C360_TABS.length]!;
              setTab(next);
              (e.currentTarget.parentElement?.children[C360_TABS.indexOf(next)] as HTMLElement)?.focus();
            }}
            className={cn(
              "border-b-2 px-3 py-2.5 text-[11px] whitespace-nowrap transition-colors",
              tab === t
                ? "border-mkt-primary font-semibold text-mkt-primary"
                : "border-transparent text-mkt-fg-muted hover:text-mkt-fg",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-px bg-mkt-border">
        {[
          ["GSTIN", "36AABCK1234M1Z9"],
          ["PAN", "AABCK1234M"],
          ["Contact", "+91 98490 •• ••"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 bg-mkt-surface-2 px-3 py-2.5">
            <p className="mb-1 text-[9px] tracking-[0.08em] text-mkt-fg-muted uppercase">{k}</p>
            <p className="mkt-num truncate text-[11.5px] text-mkt-fg" title={v}>{v}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-3">
        {[
          ["Open tasks", "6"],
          ["Outstanding", "₹1,42,000"],
          ["Documents pending", "2"],
          ["Invoices this year", "11"],
          ["Exceptions", "1"],
          ["Last activity", "2h ago"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-lg border border-mkt-border bg-mkt-surface-2 p-3">
            <p className="mb-1.5 truncate text-[9.5px] text-mkt-fg-muted">{k}</p>
            <p className="mkt-num font-mkt-display truncate text-[15px] font-semibold text-mkt-fg">{v}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const KANBAN = [
  ["To do", [["GSTR-3B — Meridian Textiles", "17 Aug", "high"], ["ITR — Alpha Pvt Ltd", "22 Aug", "medium"]]],
  ["In progress", [["Audit papers — Kavya Exports", "19 Aug", "medium"], ["Document follow-up", "18 Aug", "low"]]],
  ["Review", [["GST review — Kavya Exports", "18 Aug", "high"]]],
  ["Done", [["TDS Return — Sunrise Traders", "12 Aug", "low"], ["GSTR-1 — Meridian", "11 Aug", "low"]]],
] as const;

export function Kanban() {
  return (
    <Panel className="overflow-x-auto p-3.5 shadow-[var(--mkt-shadow-sm-elegant)]">
      <div className="grid min-w-[560px] grid-cols-4 gap-2.5">
        {KANBAN.map(([col, items]) => (
          <div key={col} className="rounded-xl border border-mkt-border bg-mkt-surface-2 p-2.5">
            <div className="mb-2.5 flex items-center justify-between text-[9.5px] tracking-[0.09em] text-mkt-fg-muted uppercase">
              {col}
              <span className="rounded-full bg-mkt-surface-3 px-1.5 py-0.5">{items.length}</span>
            </div>
            {items.map(([t, due, pri]) => (
              <div key={t} className="mb-2 rounded-lg border border-mkt-border bg-mkt-surface p-2.5">
                <p className="mb-2 text-[10.5px] leading-snug text-mkt-fg">{t}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-mkt-fg-muted">{due}</span>
                  <Tag tone={pri as "high" | "medium" | "low"}>{pri}</Tag>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

const DOCS = [
  ["Bank Statement", true],
  ["Sales Register", true],
  ["Purchase Register", false],
  ["GSTR-2B", false],
  ["Form 16", true],
] as const;

export function DocRequest() {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(DOCS.map(([n, v]) => [n, v])),
  );
  const received = Object.values(checked).filter(Boolean).length;
  const stages = ["Request", "Reminder", "Received", "Verified"];
  const stageDone = received >= 5 ? 4 : received >= 3 ? 3 : 2;

  return (
    <Panel className="p-4 shadow-[var(--mkt-shadow-sm-elegant)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[12.5px] font-medium text-mkt-fg">Document request — Kavya Exports</p>
          <p className="text-[10.5px] text-mkt-fg-muted">
            {received} of {DOCS.length} received
          </p>
        </div>
        <Tag tone="accent">Open</Tag>
      </div>
      <div className="mb-3.5 flex flex-col gap-2">
        {DOCS.map(([name]) => (
          <button
            key={name}
            type="button"
            onClick={() => setChecked((c) => ({ ...c, [name]: !c[name] }))}
            className="flex items-center gap-2.5 rounded-lg border border-mkt-border bg-mkt-surface-2 px-3 py-2.5 text-left text-[11px] text-mkt-fg transition-colors hover:border-mkt-border-hi"
          >
            <span
              className={cn(
                "grid size-4 place-items-center rounded border",
                checked[name] ? "border-mkt-primary bg-mkt-primary text-mkt-primary-fg" : "border-mkt-border-hi",
              )}
            >
              {checked[name] && <Check className="size-2.5" />}
            </span>
            {name}
            <span className="ml-auto text-[9.5px] text-mkt-fg-muted">{checked[name] ? "Received" : "Awaiting"}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 border-t border-mkt-border pt-3.5">
        {stages.map((s, i) => (
          <div key={s} className="flex-1 text-center">
            <span
              className={cn(
                "mx-auto mb-2 grid size-6 place-items-center rounded-full border text-[9px]",
                i < stageDone ? "border-mkt-primary bg-mkt-primary text-mkt-primary-fg" : "border-mkt-border bg-mkt-surface-2 text-mkt-fg-muted",
              )}
            >
              {i + 1}
            </span>
            <span className={cn("text-[9.5px]", i < stageDone ? "text-mkt-fg" : "text-mkt-fg-muted")}>{s}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Billing() {
  const rows = [
    ["QTN-2026-018", "Kavya Exports", "₹45,000", "Quotation"],
    ["INV-2026-104", "Kavya Exports", "₹45,000", "Sent"],
    ["INV-2026-101", "Meridian Textiles", "₹28,500", "Paid"],
    ["INV-2026-092", "Alpha Pvt Ltd", "₹18,000", "Overdue"],
  ];
  const tone = (s: string) =>
    s === "Paid" ? "accent" : s === "Overdue" ? "high" : s === "Sent" ? "low" : "neutral";
  return (
    <Panel className="p-4 shadow-[var(--mkt-shadow-sm-elegant)]">
      {rows.map(([id, client, amt, status]) => (
        <div
          key={id as string}
          className="mb-2 flex items-center gap-3 rounded-lg border border-mkt-border bg-mkt-surface-2 px-3 py-2.5 text-[11px]"
        >
          <span className="mkt-num font-mkt-display font-semibold text-mkt-fg">{id}</span>
          <span className="text-mkt-fg-muted">{client}</span>
          <span className="mkt-num ml-auto font-mkt-display font-semibold text-mkt-fg">{amt}</span>
          <Tag tone={tone(status as string) as "accent" | "high" | "low" | "neutral"}>{status}</Tag>
        </div>
      ))}
      <div className="mt-3.5 flex gap-1.5 border-t border-mkt-border pt-3.5">
        {["Quotation", "Draft", "Sent", "Paid"].map((s, i) => (
          <div key={s} className="flex-1 text-center">
            <span className={cn("mb-2 block h-[3px] rounded-full", i <= 2 ? "bg-mkt-primary" : "bg-mkt-border")} />
            <span className={cn("text-[9.5px] tracking-[0.06em] uppercase", i <= 2 ? "text-mkt-fg" : "text-mkt-fg-muted")}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Stories() {
  return (
    <Section id="product">
      <Eyebrow>See Artha in action</Eyebrow>
      <h2 className="font-mkt-display max-w-[18ch] text-[clamp(1.8rem,3.2vw,2.5rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
        Explore the real product, not a list of features.
      </h2>

      <div className="mt-10">
        <StoryShell
          n="01 / CLIENTS"
          title="One client. Everything connected."
          body="Every task, invoice, document and exception for a client sits on one screen — no switching, no separate registers."
          points={[
            "GSTIN, PAN and contact details on the record itself",
            "Tasks, invoices, documents and reconciliation in tabs",
            "Full activity log of who did what, and when",
          ]}
          visual={<Client360 />}
        />
        <StoryShell
          flip
          n="02 / TASKS"
          title="Know what needs to happen. Before it becomes overdue."
          body="Recurring compliance work creates itself. Everything sits on a board with owner, due date and priority."
          points={[
            "Kanban across To do, In progress, Review and Done",
            "Recurring GST, TDS and ITR work auto-created",
            "Workload visible per team member",
          ]}
          visual={<Kanban />}
        />
        <StoryShell
          n="03 / DOCUMENTS"
          title="Stop chasing documents one client at a time."
          body="Raise one request, let Artha remind the client on WhatsApp and email, and track what's still missing."
          points={[
            "Checklist-based requests per client",
            "Automated WhatsApp and email reminders",
            "Request → reminder → received → verified, tracked",
          ]}
          visual={<DocRequest />}
        />
        <StoryShell
          flip
          n="04 / BILLING"
          title="From quotation to payment, without losing the thread."
          body="Quotations convert into invoices, invoices carry their real status, and outstanding is always current."
          points={[
            "Statuses you already use: Draft, Sent, Paid, Overdue",
            "Quotation converts to invoice in one step",
            "Outstanding rolls up to the dashboard",
          ]}
          visual={<Billing />}
        />
      </div>
    </Section>
  );
}
