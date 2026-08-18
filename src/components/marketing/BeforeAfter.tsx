import { ArrowRight, Check, X } from "lucide-react";
import { Eyebrow, Panel, Section } from "./primitives";

const OLD = [
  "Excel deadline tracker",
  "WhatsApp chasing",
  "Notebooks and registers",
  "Manual reconciliation",
  "“What is pending?”",
  "DSC expiry surprises",
];
const NEW = [
  "Clients in one record",
  "Auto-created recurring tasks",
  "Document requests with reminders",
  "Auto-matched reconciliation",
  "Workload you can see",
  "Expiry alerts before they hurt",
];

export function BeforeAfter() {
  return (
    <Section>
      <Eyebrow>Before &amp; after</Eyebrow>
      <h2 className="font-mkt-display max-w-[16ch] text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
        Same filings. Less chaos. More control.
      </h2>
      <div className="mt-8 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Panel className="p-5">
          <p className="mkt-label-eyebrow mb-4 text-mkt-destructive">The old way</p>
          {OLD.map((t) => (
            <p key={t} className="flex items-center gap-2.5 py-1.5 text-[13.5px] text-mkt-fg-muted">
              <X className="size-3.5 shrink-0 text-mkt-destructive" />
              {t}
            </p>
          ))}
        </Panel>
        <div className="mx-auto grid size-10 place-items-center rounded-full border border-mkt-primary bg-[var(--mkt-wash)] text-mkt-primary">
          <ArrowRight className="size-4" />
        </div>
        <Panel className="border-mkt-primary/40 p-5">
          <p className="mkt-label-eyebrow mb-4 text-mkt-primary">With Artha</p>
          {NEW.map((t) => (
            <p key={t} className="flex items-center gap-2.5 py-1.5 text-[13.5px] text-mkt-fg-2">
              <Check className="size-3.5 shrink-0 text-mkt-primary" />
              {t}
            </p>
          ))}
        </Panel>
      </div>
    </Section>
  );
}
