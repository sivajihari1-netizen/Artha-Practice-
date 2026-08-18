import { Eyebrow, Panel, Section } from "./primitives";

// Real testimonials from the two verified early-client firms only — no
// additional quotes fabricated.
const QUOTES: [string, string, string][] = [
  [
    "Artha brought our compliance, documents and billing into one place. Our mornings are finally calm.",
    "CA Ramesh Babu",
    "Partner, V Srinivasulu and Co",
  ],
  [
    "The reconciliation engine is the part we lean on. Exceptions reach the right person the same day.",
    "CA K. Bhanu Teja",
    "Partner, K Bhanu Teja and Associates — Visakhapatnam",
  ],
];

export function SocialProof() {
  return (
    <Section>
      <Eyebrow>What CA partners say</Eyebrow>
      <h2 className="font-mkt-display max-w-[20ch] text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
        Built for CA firms. Used by CA firms.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {QUOTES.map(([q, name, role]) => (
          <Panel key={name} className="p-6">
            <p className="text-[15px] text-mkt-fg-2">&ldquo;{q}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-[var(--mkt-wash-hi)] text-[12px] font-semibold text-mkt-primary">
                {name?.split(" ")[1]?.[0] ?? "A"}
              </span>
              <div>
                <p className="text-[13px] font-medium text-mkt-fg">{name}</p>
                <p className="text-[11.5px] text-mkt-fg-muted">{role}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </Section>
  );
}
