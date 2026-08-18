import { ArrowRight } from "lucide-react";
import { Btn, Eyebrow, Section } from "../primitives";
import { SECURITY } from "../Security";

// No new claims here beyond what Security.tsx already verified — this page
// is the same SECURITY array with more room to breathe, not a new set of
// promises. See Security.tsx's own header comment for what was checked and
// where, this session.
export function SecurityBody() {
  return (
    <>
      <Section pad="tight">
        <Eyebrow>Security</Eyebrow>
        <h1 className="font-mkt-display max-w-[20ch] text-[clamp(2rem,4vw,2.9rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
          Your clients trust you with sensitive data. We take that seriously.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] text-mkt-fg-muted">
          No inflated claims — only what Artha actually enforces today.
        </p>
        <div className="mt-6">
          <Btn href="/signup">
            Start 30-Day Free Trial <ArrowRight className="size-4" />
          </Btn>
        </div>
      </Section>

      <Section pad="tight">
        <div className="grid gap-4 sm:grid-cols-2">
          {SECURITY.map(([Icon, t, d]) => (
            <div key={t} className="flex items-start gap-3 rounded-xl border border-mkt-border bg-mkt-surface-2 p-5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--mkt-wash)] text-mkt-primary">
                <Icon className="size-[16px]" />
              </span>
              <div>
                <p className="text-[14px] font-medium text-mkt-fg">{t}</p>
                <p className="mt-1 text-[13px] text-mkt-fg-muted">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
