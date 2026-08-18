"use client";

import {
  UserPlus,
  ListChecks,
  FileText,
  ReceiptIndianRupee,
  GitCompareArrows,
  TriangleAlert,
  ClipboardCheck,
  CircleCheckBig,
  FileInput,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow, Section, useInView } from "./primitives";

// Exported separately so the step names/order are unit-testable without
// invoking this hook-based ("use client") component directly — this
// project has no React test renderer, only direct function calls + tree
// walking (see the same pattern in src/lib/homeCreateMenu.ts).
export const NODES = [
  [UserPlus, "Client", "Onboard"],
  [ListChecks, "Recurring task", "Auto create"],
  [FileInput, "Document request", "Sent to client"],
  [FileText, "Document received", "Verified"],
  [ReceiptIndianRupee, "Invoice", "Raise & send"],
  [GitCompareArrows, "Reconciliation", "Auto match"],
  [TriangleAlert, "Exception", "Flagged by risk"],
  [ClipboardCheck, "Review task", "Auto assigned"],
  [CircleCheckBig, "Resolved", "Logged to activity"],
] as const;

export function Connected() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setLit((n) => (n >= NODES.length ? n : n + 1)), 260);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <Section id="connected">
      <div className="rounded-2xl border border-mkt-border bg-mkt-surface p-6 md:p-10" ref={ref}>
        <Eyebrow>Everything in your practice, connected</Eyebrow>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:items-end">
          <h2 className="font-mkt-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
            A client triggers the chain.
            <br />
            Work moves on its own.
          </h2>
          <p className="text-[14.5px] text-mkt-fg-muted">
            A client isn&apos;t just a record. It&apos;s the start of a chain that runs until something
            needs a human — and Artha tells you exactly when that is.
          </p>
        </div>

        <div className="relative mt-12">
          <div className="absolute top-[22px] right-0 left-0 hidden h-[2px] bg-mkt-border lg:block">
            <span
              className="block h-full bg-mkt-primary transition-all duration-[2200ms] ease-out"
              style={{ width: `${(Math.min(lit, NODES.length) / NODES.length) * 100}%` }}
            />
          </div>
          <div className="relative grid grid-cols-3 gap-5 sm:grid-cols-5 lg:grid-cols-9 lg:gap-2">
            {NODES.map(([Icon, title, sub], i) => {
              const on = i < lit;
              return (
                <div key={title} className="text-center">
                  <div
                    className={cn(
                      "relative z-10 mx-auto mb-3 grid size-11 place-items-center rounded-xl border transition-all duration-400",
                      on
                        ? "border-mkt-primary bg-[var(--mkt-wash)] text-mkt-primary shadow-[0_0_0_4px_var(--mkt-wash)]"
                        : "border-mkt-border bg-mkt-surface-2 text-mkt-fg-muted",
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                  <p className={cn("text-[11.5px] transition-colors", on ? "text-mkt-fg" : "text-mkt-fg-muted")}>
                    {title}
                  </p>
                  <p className={cn("text-[10px] text-mkt-fg-muted transition-opacity", on ? "opacity-100" : "opacity-60")}>
                    {sub}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-8 border-t border-mkt-border pt-6 text-[13px] text-mkt-fg-muted">
          <p>
            <span className="font-semibold text-mkt-fg">No re-entry.</span> One record, every module.
          </p>
          <p>
            <span className="font-semibold text-mkt-fg">No chasing.</span> Reminders go out on their own.
          </p>
          <p>
            <span className="font-semibold text-mkt-fg">No surprises.</span> Exceptions become tasks.
          </p>
        </div>
      </div>
    </Section>
  );
}
