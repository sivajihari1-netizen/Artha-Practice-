"use client";

import { ArrowRight, Play, Check } from "lucide-react";
import { ArthaDashboard, useDashboardCycle } from "./Dashboard";
import { Btn, Magnetic } from "./primitives";

const PROOF = [
  ["No credit card", "required"],
  ["Setup in", "15 minutes"],
  ["Free trial", "for 30 days"],
  ["Cancel anytime", "no lock-in"],
];

export function Hero({ onWatch }: { onWatch: () => void }) {
  const step = useDashboardCycle(true);

  return (
    <div id="top" className="relative overflow-hidden pt-28 md:pt-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, var(--mkt-glow), transparent 65%)" }}
      />
      <div aria-hidden className="mkt-grid-bg pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-[1180px] gap-10 px-5 pb-14 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-center">
        <div className="mkt-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-mkt-primary/30 bg-[var(--mkt-wash)] px-3 py-1 text-[10.5px] font-semibold tracking-[0.13em] text-mkt-primary uppercase">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-mkt-primary opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-mkt-primary" />
            </span>
            CA Practice Management Platform
          </span>
          <h1 className="mt-5 font-mkt-display text-[clamp(2.5rem,5.4vw,3.85rem)] leading-[1.06] font-semibold tracking-[-0.035em] text-mkt-fg">
            Your CA firm.
            <br />
            Finally, in <span className="text-mkt-primary">one system.</span>
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15.5px] text-mkt-fg-2">
            Clients, compliance, tasks, documents, billing and reconciliation — connected in one
            workspace built for Indian CA firms.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Magnetic>
              <Btn href="/signup">
                Start 30-Day Free Trial <ArrowRight className="size-4" />
              </Btn>
            </Magnetic>
            <Btn variant="ghost" onClick={onWatch}>
              <Play className="size-3.5" /> Watch Artha in Action
            </Btn>
          </div>
          <ul className="mt-7 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-2">
            {PROOF.map(([a, b]) => (
              <li key={a} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-mkt-primary" />
                <span className="text-[11.5px] leading-tight">
                  <span className="block text-mkt-fg">{a}</span>
                  <span className="text-mkt-fg-muted">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mkt-fade-up relative [animation-delay:120ms]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
            style={{ boxShadow: "var(--mkt-shadow-elegant)" }}
          />
          <div className="relative overflow-hidden rounded-2xl">
            <ArthaDashboard step={step} />
            <div
              aria-hidden
              className="mkt-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--mkt-fg)_5%,transparent)] to-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
