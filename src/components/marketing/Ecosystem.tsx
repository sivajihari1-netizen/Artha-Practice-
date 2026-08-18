import { Landmark, Building2, MessageSquare, Mail, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Eyebrow, Reveal, Section, Spotlight } from "./primitives";

// Ported from the Lovable reference's Advanced.tsx — this is its `Ecosystem`
// export, genuinely rendered in the source's Index() (between Connected and
// Statement) and previously and incorrectly excluded from this port as
// "unused dead code". Restored verbatim per the file-by-file port request.
const ECO = [
  { icon: Landmark, title: "GST returns", body: "GSTR-1, 3B and 2B data organised per client, per period." },
  { icon: Building2, title: "Income tax & MCA", body: "Filings, notices and ROC work tracked to resolution." },
  { icon: MessageSquare, title: "WhatsApp follow-ups", body: "Document requests and reminders where clients actually reply." },
  { icon: Mail, title: "Email threads", body: "Client correspondence attached to the task it belongs to." },
  { icon: FileSpreadsheet, title: "Spreadsheet & bank imports", body: "Bring ledgers and statements in without re-typing." },
  { icon: ShieldCheck, title: "DSC & licence registers", body: "Expiries surface weeks ahead, not on filing morning." },
];

export function Ecosystem() {
  return (
    <Section id="platform">
      <Reveal className="mb-8 max-w-2xl">
        <Eyebrow>One platform, not five tabs</Eyebrow>
        <h2 className="font-mkt-display text-[30px] font-semibold tracking-[-0.03em] text-mkt-fg md:text-[38px]">
          Built around how Indian practices actually work.
        </h2>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ECO.map((e, i) => (
          <Reveal key={e.title} delay={i * 60}>
            <Spotlight className="group h-full p-5">
              <e.icon className="mb-4 size-5 text-mkt-primary transition-transform duration-300 group-hover:-translate-y-0.5" />
              <h3 className="mb-1.5 text-[15.5px] text-mkt-fg">{e.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-mkt-fg-muted">{e.body}</p>
            </Spotlight>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
