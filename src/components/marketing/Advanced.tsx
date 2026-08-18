"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Receipt } from "lucide-react";
import { Eyebrow, Reveal, Section, Spotlight, Tag } from "./primitives";

// Ported from the Lovable reference's Advanced.tsx — this is its `Advanced`
// export (compliance calendar + ROI estimator), genuinely rendered in the
// source's Index() (between Reconciliation and Comparison) and previously
// and incorrectly excluded from this port as "unused dead code". Restored
// verbatim per the file-by-file port request. `Ecosystem` and `OutcomeBand`,
// also originally defined in this same source file, live in their own
// Ecosystem.tsx / OutcomeBand.tsx files in this port.

type Due = { day: number; code: string; label: string; tone: "high" | "medium" | "low" };

const DUES: Due[] = [
  { day: 7, code: "TDS", label: "TDS / TCS payment for previous month", tone: "high" },
  { day: 11, code: "GSTR-1", label: "Outward supplies return — monthly filers", tone: "high" },
  { day: 13, code: "IFF", label: "Invoice Furnishing Facility — QRMP filers", tone: "medium" },
  { day: 15, code: "PF / ESI", label: "Provident Fund and ESI contribution", tone: "medium" },
  { day: 20, code: "GSTR-3B", label: "Summary return and tax payment", tone: "high" },
  { day: 25, code: "PMT-06", label: "QRMP monthly tax payment", tone: "low" },
];

function ComplianceCalendar() {
  const [active, setActive] = useState(20);
  const due = DUES.find((d) => d.day === active);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Spotlight className="p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium text-mkt-fg">
          <CalendarDays className="size-4 text-mkt-primary" />
          Compliance calendar
        </div>
        <span className="mkt-label-eyebrow">Recurring monthly cycle</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const hit = DUES.find((x) => x.day === d);
          const isActive = active === d;
          return (
            <button
              key={d}
              type="button"
              disabled={!hit}
              aria-pressed={hit ? isActive : undefined}
              aria-label={hit ? `Day ${d}: ${hit.code} — ${hit.label}` : `Day ${d}: no statutory due date`}
              onMouseEnter={() => hit && setActive(d)}
              onFocus={() => hit && setActive(d)}
              onClick={() => hit && setActive(d)}
              className={[
                "mkt-num relative aspect-square rounded-md text-[11px] transition-all duration-200",
                hit ? "cursor-pointer font-semibold text-mkt-fg" : "cursor-default text-mkt-fg-muted/50",
                isActive
                  ? "scale-[1.06] bg-[var(--mkt-wash-hi)] ring-1 ring-mkt-primary/60"
                  : hit
                    ? "bg-mkt-surface-2 hover:bg-mkt-surface-3"
                    : "bg-mkt-surface-2/40",
              ].join(" ")}
            >
              {d}
              {hit && (
                <span
                  className={[
                    "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full",
                    hit.tone === "high" ? "bg-mkt-destructive" : hit.tone === "medium" ? "bg-mkt-warn" : "bg-mkt-info",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>

      {due && (
        <div
          key={due.day}
          aria-live="polite"
          className="mkt-fade-up mt-5 rounded-xl border border-mkt-border bg-mkt-surface-2 p-4"
        >
          <div className="mb-1.5 flex items-center gap-2">
            <Tag tone={due.tone}>{due.code}</Tag>
            <span className="mkt-num text-[12px] text-mkt-fg-muted">Day {due.day}</span>
          </div>
          <p className="text-[13.5px] text-mkt-fg-2">{due.label}</p>
          <p className="mt-2 text-[12.5px] text-mkt-fg-muted">
            Artha creates the task, assigns the preparer and reviewer, and chases the client for
            missing documents before the date arrives.
          </p>
        </div>
      )}
    </Spotlight>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] text-mkt-fg-muted">{label}</span>
        <span className="mkt-num text-[14px] font-semibold text-mkt-fg">
          {value.toLocaleString("en-IN")}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        suppressHydrationWarning
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "var(--mkt-primary)", caretColor: "transparent" }}
        className="h-1.5 w-full cursor-pointer rounded-full bg-mkt-surface-3"
      />
    </label>
  );
}

function RoiEstimator() {
  const [staff, setStaff] = useState(8);
  const [hours, setHours] = useState(5);
  const [rate, setRate] = useState(600);

  const { hoursYear, value } = useMemo(() => {
    const hoursYear = staff * hours * 48;
    return { hoursYear, value: hoursYear * rate };
  }, [staff, hours, rate]);

  return (
    <Spotlight className="p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium text-mkt-fg">
          <Receipt className="size-4 text-mkt-primary" />
          Follow-up cost estimator
        </div>
        <span className="mkt-label-eyebrow">Your numbers</span>
      </div>

      <div className="space-y-5">
        <Slider label="People in your team" value={staff} min={1} max={40} onChange={setStaff} />
        <Slider
          label="Hours each spends chasing status & documents / week"
          value={hours}
          min={1}
          max={20}
          onChange={setHours}
        />
        <Slider
          label="Blended billing rate"
          value={rate}
          min={200}
          max={3000}
          step={50}
          suffix=" /hr"
          onChange={setRate}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-mkt-border bg-mkt-surface-2 p-4">
          <p className="mkt-label-eyebrow mb-1">Hours / year</p>
          <p className="mkt-num text-[24px] font-semibold text-mkt-fg">{hoursYear.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-mkt-primary/30 bg-[var(--mkt-wash)] p-4">
          <p className="mkt-label-eyebrow mb-1 text-mkt-primary">Billable value at stake</p>
          <p className="mkt-num text-[24px] font-semibold text-mkt-primary">
            ₹{value.toLocaleString("en-IN")}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] text-mkt-fg-muted">
        An estimate from the inputs above — not a guarantee. Artha&apos;s job is to move that
        coordination time back into billable work.
      </p>
    </Spotlight>
  );
}

export function Advanced() {
  return (
    <Section id="calculator">
      <Reveal className="mb-8 max-w-2xl">
        <Eyebrow>Run the month, not the fire drill</Eyebrow>
        <h2 className="font-mkt-display text-[30px] font-semibold tracking-[-0.03em] text-mkt-fg md:text-[38px]">
          Every statutory date already knows who owns it.
        </h2>
        <p className="mt-3 text-[15px] text-mkt-fg-muted">
          Hover a due date to see what Artha does before it lands — then price what the chasing is
          costing your firm today.
        </p>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <ComplianceCalendar />
        </Reveal>
        <Reveal delay={110} className="flex flex-col gap-5">
          <RoiEstimator />
          <div className="grid flex-1 gap-3 rounded-2xl border border-mkt-border bg-mkt-surface-2/60 p-5 sm:grid-cols-3">
            {[
              ["Chasing", "Reminders go out on WhatsApp and email automatically."],
              ["Status", "Every task shows owner, stage and due date without asking."],
              ["Review", "The partner opens one screen instead of five threads."],
            ].map(([t, b]) => (
              <div key={t}>
                <p className="mkt-label-eyebrow mb-1 text-mkt-primary">{t}</p>
                <p className="text-[12.5px] leading-relaxed text-mkt-fg-muted">{b}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
