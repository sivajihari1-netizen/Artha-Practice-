import { ArrowRight, Play } from "lucide-react";
import { Btn, Section } from "./primitives";

export function FinalCta({ onWatch }: { onWatch: () => void }) {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-2xl border border-mkt-border bg-mkt-surface p-8 text-center md:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-56 left-1/2 size-[680px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, var(--mkt-glow), transparent 65%)" }}
        />
        <div className="relative">
          <h2 className="font-mkt-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
            Run your firm from one place.
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-[15px] text-mkt-fg-muted">
            Give Artha 30 days. See what changes when your practice stops living across
            spreadsheets, messages and separate tools.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Btn href="/signup">
              Start 30-Day Free Trial <ArrowRight className="size-4" />
            </Btn>
            <Btn variant="ghost" onClick={onWatch}>
              <Play className="size-3.5" /> Watch Artha in Action
            </Btn>
          </div>
        </div>
      </div>
    </Section>
  );
}
