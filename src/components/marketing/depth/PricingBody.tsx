"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, Eyebrow, Section, Tag } from "../primitives";
import { PLANS } from "../Pricing";

function recommend(seats: number) {
  return PLANS.find((p) => seats <= p.seats) ?? PLANS[PLANS.length - 1];
}

function SeatCalculator() {
  const [seats, setSeats] = useState(6);
  const plan = useMemo(() => recommend(seats), [seats]);

  return (
    <div className="rounded-2xl border border-mkt-primary bg-[var(--mkt-wash)] p-6">
      <p className="mkt-label-eyebrow text-mkt-primary">How many people need a login?</p>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[13px] text-mkt-fg-muted">Team size</span>
        <span className="mkt-num text-[20px] font-semibold text-mkt-fg">{seats}</span>
      </div>
      <input
        type="range"
        min={1}
        max={60}
        step={1}
        value={seats}
        onChange={(e) => setSeats(Number(e.target.value))}
        aria-label="Number of team members who need a login"
        style={{ accentColor: "var(--mkt-primary)" }}
        className="mt-2 h-1.5 w-full cursor-pointer rounded-full bg-mkt-surface-3"
      />
      <div className="mt-5 rounded-xl border border-mkt-border bg-mkt-surface p-4">
        <p className="text-[11px] tracking-[0.08em] text-mkt-fg-muted uppercase">Recommended plan</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <p className="font-mkt-display text-[22px] font-semibold text-mkt-fg">{plan.name}</p>
          <p className="mkt-num text-[15px] text-mkt-fg-muted">
            {plan.price} <span className="text-[11px]">/ year</span>
          </p>
        </div>
        <p className="mt-1 text-[12px] text-mkt-fg-muted">
          Covers up to {plan.seats} user{plan.seats === 1 ? "" : "s"} · {plan.sub.toLowerCase()}
        </p>
        <Btn href="/signup" size="sm" className="mt-4 w-full justify-center">
          Start free trial
        </Btn>
      </div>
      <p className="mt-3 text-[11px] text-mkt-fg-muted">
        An estimate from the seat count above — every plan includes every feature, so this only
        changes which price tier fits your team.
      </p>
    </div>
  );
}

export function PricingBody() {
  return (
    <>
      <Section pad="tight">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="font-mkt-display max-w-[18ch] text-[clamp(2rem,4vw,2.9rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
          Choose the plan that fits your firm.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] text-mkt-fg-muted">
          Five fixed-price tiers, billed annually plus GST. Every plan includes every feature —
          the only thing that changes is how many people can log in.
        </p>
      </Section>

      <Section pad="tight">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-mkt-surface p-5",
                  p.popular ? "border-mkt-primary shadow-[0_20px_60px_-30px_var(--mkt-glow)]" : "border-mkt-border",
                )}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-5">
                    <Tag tone="accent">Most popular</Tag>
                  </span>
                )}
                <p className="font-mkt-display text-[17px] font-semibold text-mkt-fg">{p.name}</p>
                <p className="mb-4 text-[11.5px] text-mkt-fg-muted">{p.sub}</p>
                <p className="mkt-num font-mkt-display text-[26px] font-semibold text-mkt-fg">
                  {p.price}
                  <span className="text-[12px] font-normal text-mkt-fg-muted"> / year</span>
                </p>
                <ul className="my-5 flex flex-1 flex-col gap-2">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12.5px] text-mkt-fg-2">
                      <Check className="size-3.5 text-mkt-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Btn variant={p.popular ? "primary" : "ghost"} size="sm" href="/signup">
                  Start free trial
                </Btn>
              </div>
            ))}
          </div>
          <SeatCalculator />
        </div>
        <p className="mt-6 text-[11.5px] text-mkt-fg-muted">All plans billed annually, plus GST.</p>
      </Section>
    </>
  );
}
