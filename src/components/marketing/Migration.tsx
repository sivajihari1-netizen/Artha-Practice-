import { Eyebrow, Reveal, Section, Spotlight } from "./primitives";

// Ported from the Lovable reference's Compare.tsx — this is its `Migration`
// export. `Comparison`, also defined in this same source file, lives in its
// own Comparison.tsx in this port.
const STEPS: [string, string, string][] = [
  ["Day 0", "Import your client list", "CSV or spreadsheet — GSTIN, PAN, contact, services. Nothing retyped."],
  ["Day 1", "Turn on the compliance calendar", "GST, TDS, ITR and ROC dates generate recurring tasks for every client."],
  ["Day 2", "Assign your team", "Staff get their own queue. You get one view of load across the firm."],
  ["Week 1", "Reminders run themselves", "Document requests and follow-ups go out on WhatsApp and email automatically."],
  ["Week 2", "Reconciliation on autopilot", "Mismatches are flagged, assigned and tracked to resolution."],
];

export function Migration() {
  return (
    <Section id="migration">
      <Reveal>
        <Eyebrow>Getting started</Eyebrow>
        <h2 className="font-mkt-display max-w-[20ch] text-[34px] font-semibold tracking-[-0.032em] text-mkt-fg md:text-[44px]">
          Live in two weeks. <span className="text-mkt-primary">Without a project.</span>
        </h2>
      </Reveal>

      <div className="mt-9 grid gap-4 md:grid-cols-5">
        {STEPS.map(([when, title, body], i) => (
          <Reveal key={title} delay={i * 70}>
            <Spotlight className="h-full p-5">
              <p className="mkt-label-eyebrow text-mkt-primary">{when}</p>
              <div className="my-3 h-px w-full bg-mkt-border" />
              <p className="font-mkt-display text-[15px] font-semibold text-mkt-fg">{title}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mkt-fg-muted">{body}</p>
            </Spotlight>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
