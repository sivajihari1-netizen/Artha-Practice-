import { Check, X, Minus } from "lucide-react";
import { Eyebrow, Reveal, Section } from "./primitives";

// Ported from the Lovable reference's Compare.tsx — this is its `Comparison`
// export, genuinely rendered in the source's Index() (between Advanced and
// BeforeAfter) and previously and incorrectly excluded from this port as
// "unused dead code". Restored verbatim per the file-by-file port request.
// `Migration`, also defined in this same source file, lives in its own
// Migration.tsx in this port.
const COLS = ["Spreadsheets + WhatsApp", "Generic PM tools", "Artha"];

const ROWS: [string, ("yes" | "no" | "part")[]][] = [
  ["Client 360 with GSTIN, PAN, DSC", ["no", "part", "yes"]],
  ["Statutory due-date calendar (GST, TDS, ITR)", ["no", "no", "yes"]],
  ["Recurring compliance tasks auto-created", ["no", "part", "yes"]],
  ["Document requests with reminders", ["no", "part", "yes"]],
  ["GST reconciliation with mismatch flags", ["no", "no", "yes"]],
  ["Invoice pipeline: Draft → Sent → Paid → Overdue", ["part", "no", "yes"]],
  ["Exceptions become assigned tasks", ["no", "no", "yes"]],
  ["One record shared across every module", ["no", "part", "yes"]],
];

function Cell({ v }: { v: "yes" | "no" | "part" }) {
  if (v === "yes")
    return (
      <span className="mx-auto grid size-6 place-items-center rounded-full bg-[var(--mkt-wash-hi)] text-mkt-primary">
        <Check className="size-3.5" />
      </span>
    );
  if (v === "part")
    return (
      <span className="mx-auto grid size-6 place-items-center rounded-full bg-[var(--mkt-warn-wash)] text-mkt-warn">
        <Minus className="size-3.5" />
      </span>
    );
  return (
    <span className="mx-auto grid size-6 place-items-center rounded-full bg-mkt-surface-3 text-mkt-fg-muted">
      <X className="size-3.5" />
    </span>
  );
}

export function Comparison() {
  return (
    <Section id="compare">
      <Reveal>
        <Eyebrow>How firms run today</Eyebrow>
        <h2 className="font-mkt-display max-w-[19ch] text-[34px] font-semibold tracking-[-0.03em] text-mkt-fg md:text-[44px]">
          The tools weren&apos;t built for a <span className="text-mkt-primary">practice</span>.
        </h2>
        <p className="mt-4 max-w-[62ch] text-mkt-fg-muted">
          Spreadsheets don&apos;t know a due date. Generic project tools don&apos;t know a GSTIN.
          Artha does both, because it was written around Indian compliance work.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-9 overflow-x-auto rounded-2xl border border-mkt-border bg-mkt-surface">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-mkt-border">
                <th className="px-5 py-4 text-left text-[11px] font-semibold tracking-[0.1em] text-mkt-fg-muted uppercase">
                  Capability
                </th>
                {COLS.map((c, i) => (
                  <th
                    key={c}
                    className={`px-4 py-4 text-center text-[12px] font-semibold ${
                      i === 2 ? "bg-[var(--mkt-wash)] text-mkt-primary" : "text-mkt-fg-muted"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, vals]) => (
                <tr key={label} className="border-b border-mkt-border last:border-b-0 hover:bg-mkt-surface-2">
                  <td className="px-5 py-3 text-mkt-fg-2">{label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`px-4 py-3 ${i === 2 ? "bg-[var(--mkt-wash)]" : ""}`}>
                      <Cell v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}
