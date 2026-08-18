import { ArrowRight } from "lucide-react";
import { Btn, CountUp, Eyebrow, Reveal, Section, Spotlight } from "./primitives";

// Ported from the Lovable reference's Advanced.tsx — this is its
// `OutcomeBand` export. `Advanced` (compliance calendar + ROI estimator) and
// `Ecosystem`, also defined in this same source file, live in their own
// Advanced.tsx / Ecosystem.tsx in this port.
//
// Deliberate deviation from source (disclosed, from an earlier authorized
// QA pass): the 3-stat grid below is `grid-cols-1 sm:grid-cols-3` with
// `min-w-0` on each tile, not the source's bare `grid-cols-3` — the source
// version cramped on narrow mobile widths.
export function OutcomeBand({ onWatch }: { onWatch?: () => void }) {
  return (
    <Section>
      <Reveal>
        <Spotlight className="mkt-aura overflow-hidden p-7 md:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
            <div>
              <Eyebrow>What changes in week one</Eyebrow>
              <h2 className="font-mkt-display text-[28px] font-semibold tracking-[-0.03em] text-mkt-fg md:text-[34px]">
                Nothing sits in someone&apos;s head anymore.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] text-mkt-fg-muted">
                Every client, deadline, document request and invoice has an owner, a state and a
                trail. The partner review becomes a screen, not a meeting.
              </p>
              <Btn className="mt-6" onClick={onWatch}>
                Watch Artha work <ArrowRight className="size-4" />
              </Btn>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { n: 1, s: "", l: "workspace for the whole firm" },
                { n: 5, s: "", l: "connected modules" },
                { n: 30, s: "-day", l: "free trial, no card" },
              ].map((k) => (
                <div key={k.l} className="min-w-0 rounded-xl border border-mkt-border bg-mkt-surface-2 p-4">
                  <p className="text-[26px] font-semibold text-mkt-primary">
                    <CountUp to={k.n} suffix={k.s} />
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-mkt-fg-muted">{k.l}</p>
                </div>
              ))}
            </div>
          </div>
        </Spotlight>
      </Reveal>
    </Section>
  );
}
