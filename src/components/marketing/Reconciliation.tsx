"use client";

import { useEffect, useState } from "react";
import {
  TriangleAlert,
  ScanSearch,
  Gauge,
  ClipboardPlus,
  UserCheck,
  Eye,
  CircleCheckBig,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, Eyebrow, Section, Tag, useInView } from "./primitives";

const FLOW = [
  [TriangleAlert, "Exception detected"],
  [ScanSearch, "GSTIN mismatch"],
  [Gauge, "Risk scored"],
  [ClipboardPlus, "Task created"],
  [UserCheck, "Assigned to Priya"],
  [Eye, "Review"],
  [CircleCheckBig, "Resolved"],
] as const;

export function Reconciliation({ onWatch }: { onWatch: () => void }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [pct, setPct] = useState(0);
  const [lit, setLit] = useState(0);
  // Once the visitor drags the scrubber, autoplay stops and the donut/flow
  // track the slider directly — a signature interaction, not just a replay.
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!inView || manual) return;
    const a = setTimeout(() => setPct(94), 250);
    const b = setInterval(() => setLit((n) => (n >= FLOW.length ? n : n + 1)), 330);
    return () => {
      clearTimeout(a);
      clearInterval(b);
    };
  }, [inView, manual]);

  function scrubTo(step: number) {
    setManual(true);
    setLit(step);
    setPct(Math.round((step / FLOW.length) * 94));
  }

  function replay() {
    setManual(false);
    setLit(0);
    setPct(0);
  }

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <Section id="reconciliation">
      <div ref={ref} className="relative overflow-hidden rounded-2xl border border-mkt-border bg-mkt-surface p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -bottom-56 size-[620px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--mkt-glow), transparent 64%)" }}
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-center lg:gap-14">
          <div>
            <Eyebrow>The reconciliation engine</Eyebrow>
            <h2 className="font-mkt-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
              Stop checking GSTR-2B by eye.
              <br />
              <span className="text-mkt-primary">Let Artha flag what doesn&apos;t match.</span>
            </h2>
            <p className="mt-4 text-[14.5px] text-mkt-fg-muted">
              Upload GSTR-2B and your purchase register. Artha matches line by line, scores the risk,
              and turns every exception into an assigned task.
            </p>
            <div className="mt-6">
              <Btn variant="ghost" onClick={onWatch}>
                See reconciliation in action <ArrowRight className="size-4" />
              </Btn>
            </div>
          </div>

          <div>
            <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
              <Ledger label="GSTR-2B" sub="Kavya Exports" amount="₹12,84,250" records="1,842" />
              <div className="flex min-w-[200px] flex-col items-center rounded-2xl border border-mkt-primary bg-[var(--mkt-wash)] p-5 text-center">
                <p className="mkt-label-eyebrow text-mkt-primary">Artha match engine</p>
                <div className="relative my-3 size-[124px]">
                  <svg viewBox="0 0 124 124" className="-rotate-90">
                    <circle cx="62" cy="62" r={R} className="fill-none stroke-mkt-border" strokeWidth="10" />
                    <circle
                      cx="62"
                      cy="62"
                      r={R}
                      className="fill-none stroke-mkt-primary transition-[stroke-dasharray] duration-1000 ease-out"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * C} 999`}
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-content-center text-center">
                    <p className="mkt-num font-mkt-display text-[29px] leading-none font-semibold text-mkt-fg">{pct}%</p>
                    <p className="text-[9.5px] tracking-[0.09em] text-mkt-fg-muted uppercase">Matched</p>
                  </div>
                </div>
                <p className="mkt-num mb-3 text-[11.5px] text-mkt-fg-muted">
                  6% exceptions · <span className="text-mkt-fg">₹32,850</span>
                </p>
                <Tag tone="high">High risk</Tag>
              </div>
              <Ledger label="Purchase register" sub="Kavya Exports" amount="₹12,51,400" records="1,826" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {FLOW.map(([Icon, label], i) => {
                const on = i < lit;
                return (
                  <div
                    key={label}
                    className={cn(
                      "rounded-xl border bg-mkt-surface-2 p-2.5 text-center transition-all duration-400",
                      on ? "border-mkt-border-hi opacity-100" : "border-mkt-border opacity-40",
                      on && i === FLOW.length - 1 && "border-mkt-primary",
                    )}
                  >
                    <Icon className={cn("mx-auto mb-2 size-[15px]", on ? "text-mkt-primary" : "text-mkt-fg-muted")} />
                    <p className="text-[9.5px] leading-tight text-mkt-fg">{label}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-mkt-border bg-mkt-surface-2 p-3.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] tracking-[0.09em] text-mkt-fg-muted uppercase">
                  Drag to scrub the match, step by step
                </span>
                <button
                  type="button"
                  onClick={replay}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-mkt-primary hover:underline"
                >
                  <RotateCcw className="size-3" /> Replay
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={FLOW.length}
                step={1}
                value={lit}
                onChange={(e) => scrubTo(Number(e.target.value))}
                aria-label="Scrub through the GSTR-2B reconciliation replay"
                aria-valuetext={lit === 0 ? "Not started" : (FLOW[lit - 1]?.[1] as string)}
                style={{ accentColor: "var(--mkt-primary)" }}
                className="h-1.5 w-full cursor-pointer rounded-full bg-mkt-surface-3"
              />
              <p className="mkt-num mt-2 text-[11px] text-mkt-fg-muted">
                {lit === 0 ? "Idle" : `Step ${lit} of ${FLOW.length}: ${FLOW[lit - 1]?.[1]}`}
              </p>
            </div>

            <p className="mt-3 text-[11px] text-mkt-fg-muted italic">
              Figures shown are illustrative example values, not real customer data.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Ledger({ label, sub, amount, records }: { label: string; sub: string; amount: string; records: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-mkt-border bg-mkt-surface-2 p-4">
      <p className="mkt-label-eyebrow text-mkt-fg-muted">{label}</p>
      <p className="mt-0.5 mb-4 text-[11px] text-mkt-fg-muted">{sub}</p>
      <p className="text-[10px] tracking-[0.05em] text-mkt-fg-muted uppercase">Total purchases</p>
      <p className="mkt-num font-mkt-display text-[20px] font-semibold text-mkt-fg">{amount}</p>
      <p className="mt-3 text-[10px] tracking-[0.05em] text-mkt-fg-muted uppercase">Records</p>
      <p className="mkt-num font-mkt-display text-[20px] font-semibold text-mkt-fg">{records}</p>
    </div>
  );
}
