"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dot, Tag, usePrefersReducedMotion } from "./primitives";

// Adapted from the Lovable reference build's Dashboard.tsx, corrected to
// match the CURRENT production Home experience exactly (src/app/dashboard/
// page.tsx, shipped this session): KPI labels are "Overdue Work" / "Due
// Soon" / "Reconciliation" / "Outstanding" / "Revenue (MTD)" — not the
// Lovable source's "Overdue"/"Recon"/"Owed"/"Revenue (YTD)" — and the
// Overdue Work + Team Load columns sit under an "Operational Pulse" section
// label, matching production's own section heading verbatim.
const NAV = [
  "Home",
  "Tasks",
  "Clients",
  "Invoices",
  "Documents",
  "Reconciliation",
  "Staff",
  "Reports",
  "DSC",
  "Leads",
  "Settings",
];

const KPIS = [
  { label: "Overdue Work", value: "7", sub: "+2 today", tone: "high" as const, wide: false },
  { label: "Due Soon", value: "9", sub: "+3 today", tone: "medium" as const, wide: false },
  { label: "Reconciliation", value: "4", sub: "To review", tone: "low" as const, wide: false },
  { label: "Outstanding", value: "₹4.2L", sub: "16 clients", tone: "accent" as const, wide: false },
  { label: "Revenue (MTD)", value: "₹1.21Cr", sub: "This month", tone: "accent" as const, wide: true },
];

/**
 * The live product story: normal -> exception -> risk -> task created ->
 * task lands in Overdue Work -> resolved -> normal.
 */
export function useDashboardCycle(active = true, interval = 2100) {
  const [step, setStep] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!active || reduced) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (t) return;
      t = setInterval(() => setStep((s) => (s + 1) % 6), interval);
    };
    const stop = () => {
      if (t) clearInterval(t);
      t = undefined;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, interval, reduced]);
  return step;
}

export function ArthaDashboard({ step, compact = false }: { step: number; compact?: boolean }) {
  const flagged = step >= 1;
  const risk = step >= 2;
  const taskCreated = step >= 3;
  const inOverdue = step >= 4;
  const resolved = step >= 5;
  const [view, setView] = useState("Home");

  return (
    <div className="overflow-hidden rounded-xl border border-mkt-border bg-mkt-surface shadow-[var(--mkt-shadow-elegant)]">
      <div className="flex items-center justify-between border-b border-mkt-border px-4 py-3">
        <span className="font-mkt-display text-[15px] font-semibold tracking-[-0.03em] text-mkt-fg">Artha.</span>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-md border border-mkt-border bg-mkt-surface-2 px-2.5 py-1 text-[10.5px] text-mkt-fg-muted sm:inline">
            All Clients
          </span>
          <span className="grid size-6 place-items-center rounded-full bg-[var(--mkt-wash-hi)] text-[10px] font-semibold text-mkt-primary">
            P
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] md:grid-cols-[118px_1fr]">
        <aside aria-label="Artha demo navigation" className="hidden flex-col border-r border-mkt-border p-2 md:flex">
          <div className="flex-1">
            {NAV.map((n) => (
              <button
                key={n}
                type="button"
                aria-current={view === n ? "page" : undefined}
                onClick={() => setView(n)}
                className={cn(
                  "block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors",
                  view === n
                    ? "bg-[var(--mkt-wash)] font-medium text-mkt-primary"
                    : "text-mkt-fg-muted hover:bg-mkt-surface-2 hover:text-mkt-fg-2",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-mkt-border pt-2">
            <div className="flex items-center gap-2 px-1.5 py-1">
              <span className="grid size-5 place-items-center rounded-full bg-[var(--mkt-wash-hi)] text-[9px] font-semibold text-mkt-primary">
                P
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10.5px] leading-tight text-mkt-fg">Priya</span>
                <span className="block text-[9px] leading-tight text-mkt-fg-muted">Partner</span>
              </span>
            </div>
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10.5px] text-mkt-fg-muted transition-colors hover:bg-mkt-surface-2 hover:text-mkt-fg-2"
            >
              <LogOut className="size-3" /> Logout
            </button>
          </div>
        </aside>

        <div className="col-span-2 p-3.5 md:col-span-1">
          {view !== "Home" ? (
            <OtherView view={view} />
          ) : (
            <>
              <div className="mb-3">
                <p className="font-mkt-display text-[14px] font-semibold text-mkt-fg">Good morning, Priya</p>
                <p className="text-[11px] text-mkt-fg-muted">
                  Monday, 17 August — here&apos;s what needs your attention.
                </p>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {KPIS.map((k) => (
                  <div
                    key={k.label}
                    className={cn(
                      "rounded-lg border border-mkt-border bg-mkt-surface-2 p-2.5",
                      k.wide && "col-span-2 sm:col-span-3 lg:col-span-1",
                    )}
                  >
                    <div className="mb-1.5 flex items-start gap-1.5">
                      <span className="mt-[3px]">
                        <Dot tone={k.tone} />
                      </span>
                      <span className="min-w-0 truncate text-[8px] leading-[1.3] tracking-[0.05em] whitespace-nowrap text-mkt-fg-muted uppercase">
                        {k.label}
                      </span>
                    </div>
                    <p className="mkt-num font-mkt-display truncate text-[17px] leading-none font-semibold text-mkt-fg">
                      {k.value}
                    </p>
                    <p className="mkt-num mt-1 truncate text-[9.5px] whitespace-nowrap text-mkt-fg-muted">{k.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mb-2 text-[9px] tracking-[0.11em] text-mkt-fg-muted uppercase">Attention</div>
              <div className="mb-3 rounded-lg border border-mkt-border bg-mkt-surface-2 p-2.5">
                <Row
                  tone="high"
                  text="GST reconciliation failed"
                  right={risk ? <Tag tone="high">High risk</Tag> : <Tag tone="high">High</Tag>}
                  active={flagged && !resolved}
                  done={resolved}
                />
                <Row tone="medium" text="7 tasks overdue" right={<Tag tone="medium">Medium</Tag>} />
                <Row tone="medium" text="DSC expiring in 12 days" right={<Tag tone="medium">Medium</Tag>} />
                <Row tone="low" text="ITR filing due in 5 days" right={<Tag tone="low">Low</Tag>} />
                <div
                  className={cn(
                    "mt-2 overflow-hidden transition-all duration-500",
                    taskCreated ? "max-h-16 opacity-100" : "max-h-0 opacity-0",
                  )}
                >
                  <div className="rounded-md border border-mkt-primary/60 bg-[var(--mkt-wash)] px-2.5 py-2 text-[10.5px] text-mkt-primary">
                    {resolved
                      ? "Resolved · Review task marked complete"
                      : "Task created · Review GST mismatch → Priya Shetty"}
                  </div>
                </div>
              </div>

              <p className="mb-2 text-[9px] tracking-[0.11em] text-mkt-fg-muted uppercase">Operational Pulse</p>
              <div className="grid gap-2 lg:grid-cols-[1.35fr_1fr]">
                <div className="rounded-lg border border-mkt-border bg-mkt-surface-2 p-2.5">
                  <p className="mb-2 text-[9px] tracking-[0.11em] text-mkt-fg-muted uppercase">Overdue Work</p>
                  {[
                    ["GST Return — Meridian Textiles", "3d"],
                    ["Audit papers — Kavya Exports", "2d"],
                    ["TDS Return — Alpha Pvt Ltd", "1d"],
                  ].map(([t, d]) => (
                    <div key={t} className="flex items-center justify-between py-1 text-[10.5px]">
                      <span className="text-mkt-fg-2">{t}</span>
                      <span className="text-mkt-fg-muted">{d}</span>
                    </div>
                  ))}
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-500",
                      inOverdue ? "max-h-10 opacity-100" : "max-h-0 opacity-0",
                    )}
                  >
                    <div className="flex items-center justify-between border-t border-mkt-border pt-1.5 text-[10.5px]">
                      <span className={cn(resolved ? "text-mkt-fg-muted line-through" : "text-mkt-primary")}>
                        Review GST mismatch — Kavya Exports
                      </span>
                      <span className="text-mkt-fg-muted">{resolved ? "Resolved" : "Today"}</span>
                    </div>
                  </div>
                </div>

                {!compact && (
                  <div className="rounded-lg border border-mkt-border bg-mkt-surface-2 p-2.5">
                    <p className="mb-2 text-[9px] tracking-[0.11em] text-mkt-fg-muted uppercase">Team Load</p>
                    {[
                      ["Ravi Kumar", 92, "4 clients"],
                      ["Anil Menon", 64, "3 clients"],
                      ["Priya Shetty", 38, "Light"],
                      ["Neha Sharma", 74, "6 clients"],
                    ].map(([name, pct, note]) => (
                      <div key={name as string} className="mb-2 flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[10.5px] text-mkt-fg">{name}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-mkt-surface-3">
                          <span
                            className="block h-full rounded-full bg-mkt-primary transition-all duration-700"
                            style={{
                              width: `${name === "Priya Shetty" && taskCreated ? 58 : (pct as number)}%`,
                            }}
                          />
                        </span>
                        <span className="w-14 text-right text-[9.5px] text-mkt-fg-muted">{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OtherView({ view }: { view: string }) {
  const rows: Record<string, [string, string, string][]> = {
    Tasks: [
      ["GSTR-3B — Meridian Textiles", "Ravi Kumar", "Due 20 Aug"],
      ["TDS Return — Alpha Pvt Ltd", "Anil Menon", "Overdue 1d"],
      ["Audit papers — Kavya Exports", "Neha Sharma", "Due 22 Aug"],
      ["Review GST mismatch", "Priya Shetty", "Today"],
    ],
    Invoices: [
      ["INV-2041 — Meridian Textiles", "₹48,000", "Paid"],
      ["INV-2042 — Kavya Exports", "₹1,20,000", "Sent"],
      ["INV-2043 — Alpha Pvt Ltd", "₹36,500", "Overdue"],
      ["INV-2044 — Sri Balaji Traders", "₹22,000", "Draft"],
    ],
    Clients: [
      ["Meridian Textiles", "GST + Audit", "16 open"],
      ["Kavya Exports", "GST + TDS", "9 open"],
      ["Alpha Pvt Ltd", "ITR + ROC", "4 open"],
      ["Sri Balaji Traders", "GST", "2 open"],
    ],
  };
  const data = rows[view] ?? [
    [`${view} module`, "Live in Artha", "—"],
    ["Everything shares one client record", "No re-entry", "—"],
  ];
  return (
    <div className="mkt-fade-up">
      <p className="mb-2 font-mkt-display text-[14px] font-semibold text-mkt-fg">{view}</p>
      <div className="rounded-lg border border-mkt-border bg-mkt-surface-2 p-1">
        {data.map(([a, b, c]) => (
          <div
            key={a}
            className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[10.5px] hover:bg-mkt-surface-3"
          >
            <span className="min-w-0 flex-1 truncate text-mkt-fg-2">{a}</span>
            <span className="shrink-0 text-mkt-fg-muted">{b}</span>
            <span className="w-20 shrink-0 text-right text-mkt-fg-muted">{c}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-mkt-fg-muted">Click through the sidebar — this is the real Artha layout.</p>
    </div>
  );
}

function Row({
  tone,
  text,
  right,
  active,
  done,
}: {
  tone: "high" | "medium" | "low";
  text: string;
  right: React.ReactNode;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-2 py-1.5 transition-all duration-500",
        active && "bg-[var(--mkt-danger-wash)] ring-1 ring-mkt-destructive/40",
        done && "opacity-55",
      )}
    >
      <span className="flex items-center gap-2 text-[10.5px] text-mkt-fg-2">
        <Dot tone={tone} />
        {text}
      </span>
      {right}
    </div>
  );
}
