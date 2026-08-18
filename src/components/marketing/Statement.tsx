"use client";

import { cn } from "@/lib/utils";
import { Section, Inner, Eyebrow, useInView, usePrefersReducedMotion } from "./primitives";

// The single oversized editorial moment on the page — ported from the
// Lovable reference's Editorial.tsx (only its `Statement` export is used in
// the live composition; `Pinned`, the scroll-pinned walkthrough, was unused
// dead code in the source too and is left out of this port).
const LINE = "The whole practice, in one honest view.";

export function Statement() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const reduced = usePrefersReducedMotion();
  const words = LINE.split(" ");

  return (
    <Section bleed pad="tight" className="relative overflow-hidden border-y border-mkt-border bg-mkt-surface/40">
      <div className="mkt-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <Inner>
        <div ref={ref} className="relative py-6">
          <Eyebrow>Why firms move</Eyebrow>
          <h2 className="font-mkt-display max-w-[15ch] text-[clamp(38px,8.5vw,104px)] leading-[0.94] font-semibold tracking-[-0.045em] text-mkt-fg">
            {words.map((w, i) => (
              <span
                key={`${w}-${i}`}
                className={cn(
                  "mr-[0.24em] inline-block transition-[opacity,transform] duration-700 [transition-timing-function:cubic-bezier(0.2,0.7,0.3,1)]",
                  reduced || inView ? "translate-y-0 opacity-100" : "translate-y-[0.4em] opacity-0",
                  w === "honest" && "text-mkt-primary",
                )}
                style={{ transitionDelay: reduced ? "0ms" : `${i * 70}ms` }}
              >
                {w}
              </span>
            ))}
          </h2>
          <p className="mt-8 max-w-xl text-[16px] text-mkt-fg-muted">
            Not five tools stitched together — clients, deadlines, documents, billing and
            reconciliation reading from the same record, so the partner never has to ask &quot;where
            does this stand?&quot;
          </p>
        </div>
      </Inner>
    </Section>
  );
}
