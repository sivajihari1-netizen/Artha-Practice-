import {
  Landmark,
  CalendarClock,
  FolderCheck,
  ReceiptIndianRupee,
  GitCompareArrows,
  MessageCircle,
  Gift,
} from "lucide-react";
import { Section } from "./primitives";

const FIRMS: [string, string][] = [
  ["K Bhanu Teja and Associates", "Visakhapatnam"],
  ["V Srinivasulu and Co", "Hyderabad"],
];

/** Neutral practice-reality statements between firm names — proof, not padding. */
const NOTES = [
  "GST · TDS · ITR · ROC in one workspace",
  "Every deadline has an owner",
  "Document chasing on WhatsApp & email",
  "GSTR-2B matched line by line",
  "Draft → Sent → Paid, visible to the partner",
  "More firms onboarding with Artha",
];

const CAPS = [
  [Landmark, "GST, TDS, ITR", "Built-in compliance"],
  [CalendarClock, "Tasks & deadlines", "Never miss a due date"],
  [FolderCheck, "Document workflow", "Stop chasing documents"],
  [ReceiptIndianRupee, "Billing & invoicing", "Know what you're owed"],
  [GitCompareArrows, "Reconciliation engine", "Auto-match & flag issues"],
  [MessageCircle, "WhatsApp + Email", "Automated reminders"],
  [Gift, "30-day free trial", "No credit card required"],
] as const;

export function TrustStrip() {
  return (
    <Section pad="tight">
      <div className="overflow-hidden rounded-2xl border border-mkt-border bg-mkt-surface px-7 py-6">
        <p className="mkt-label-eyebrow mb-4 text-center text-mkt-fg-muted">Built for CA firms like yours</p>
        <div className="mkt-edge-fade overflow-hidden">
          <div className="mkt-marquee-track flex items-center">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
                {FIRMS.map(([n, city], i) => (
                  <div key={n} className="flex items-center">
                    <div className="shrink-0 px-8">
                      <p className="font-mkt-display text-[14px] font-semibold whitespace-nowrap text-mkt-fg">{n}</p>
                      <p className="text-[11.5px] whitespace-nowrap text-mkt-fg-muted">{city}</p>
                    </div>
                    {NOTES.slice(i * 3, i * 3 + 3).map((note) => (
                      <p
                        key={note}
                        className="shrink-0 border-l border-mkt-border px-8 text-[12px] whitespace-nowrap text-mkt-fg-muted"
                      >
                        {note}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function CapabilityStrip() {
  return (
    <Section pad="none">
      <div className="grid overflow-hidden rounded-2xl border border-mkt-border bg-mkt-surface sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {CAPS.map(([Icon, title, sub]) => (
          <div
            key={title}
            className="border-b border-mkt-border p-5 last:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0"
          >
            <div className="mb-3 grid size-8 place-items-center rounded-lg bg-[var(--mkt-wash)] text-mkt-primary">
              <Icon className="size-[15px]" />
            </div>
            <p className="text-[12.5px] font-medium text-mkt-fg">{title}</p>
            <p className="text-[11.5px] text-mkt-fg-muted">{sub}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
