"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow, Section } from "./primitives";

const FAQS: [string, string][] = [
  ["Who is Artha for?", "Indian CA firms — from solo practitioners to multi-partner practices running GST, TDS, ITR, audit and advisory work."],
  ["How does the 30-day free trial work?", "Full access for 30 days, no credit card. At the end you pick a plan to continue."],
  ["Can I add my team?", "Yes. Add staff, assign clients and tasks, and control what each role can see."],
  ["Can clients receive WhatsApp reminders?", "Yes. Document requests and pending items can go out over WhatsApp and email automatically."],
  ["How does reconciliation work?", "Upload GSTR-2B and your purchase register. Artha matches line by line, scores exceptions by risk, and creates review tasks."],
  ["Is my firm's data isolated?", "Yes. Each firm's workspace is scoped to that firm, with role-based access inside it."],
  ["Can I upgrade later?", "Yes — plans can be changed at any point from your billing dashboard."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-14">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="font-mkt-display text-[clamp(1.6rem,2.8vw,2.1rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
            Questions CA firms ask us.
          </h2>
        </div>
        <div className="divide-y divide-mkt-border border-y border-mkt-border">
          {FAQS.map(([q, a], i) => (
            <div key={q}>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={open === i}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-[14.5px] font-medium text-mkt-fg"
              >
                {q}
                <span
                  aria-hidden
                  className={cn("text-mkt-primary transition-transform duration-200", open === i && "rotate-45")}
                >
                  +
                </span>
              </button>
              <div
                id={`faq-a-${i}`}
                role="region"
                aria-labelledby={`faq-q-${i}`}
                inert={open === i ? undefined : true}
                className={cn(
                  "overflow-hidden text-[13.5px] text-mkt-fg-muted transition-all duration-300",
                  open === i ? "max-h-40 pb-4 opacity-100" : "max-h-0 opacity-0",
                )}
              >
                {a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
