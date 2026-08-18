import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, Eyebrow, Section, Tag } from "./primitives";

// Verified against prisma/seed.ts -> Plan table (read live by
// /dashboard/billing) this session — re-checked immediately before writing
// this file, no discrepancy found. The Lovable source's Solo/Starter/
// Professional/Enterprise/Custom figures and per-plan "N clients" limits do
// not exist anywhere in the schema (Plan has maxUsers + storageGb only, no
// client cap, no "Professional" or "Custom/contact sales" tier) and are NOT
// used here. Five real, fixed-price, self-serve tiers — Growth carries
// "Most popular" since it's the real middle tier.
// `seats` mirrors each plan's maxUsers from prisma/seed.ts exactly — added
// so the /pricing seat calculator can recommend a real tier by user count
// without re-deriving it from the `feats` display strings.
export const PLANS = [
  { name: "Solo", sub: "For individual CAs", price: "₹1,000", seats: 1, feats: ["1 user", "2 GB storage", "Unlimited clients"], popular: false },
  { name: "Starter", sub: "For small teams", price: "₹7,500", seats: 10, feats: ["10 users", "5 GB storage", "Unlimited clients"], popular: false },
  { name: "Growth", sub: "For growing firms", price: "₹12,500", seats: 20, feats: ["20 users", "5 GB storage", "Unlimited clients"], popular: true },
  { name: "Scale", sub: "For larger practices", price: "₹17,000", seats: 40, feats: ["40 users", "10 GB storage", "Unlimited clients"], popular: false },
  { name: "Enterprise", sub: "For large teams", price: "₹27,000", seats: 60, feats: ["60 users", "20 GB storage", "Unlimited clients"], popular: false },
] as const;

export function Pricing() {
  return (
    <Section id="pricing">
      <Eyebrow>Simple pricing</Eyebrow>
      <h2 className="font-mkt-display max-w-[16ch] text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-0.032em] text-mkt-fg">
        Choose the plan that fits your firm.
      </h2>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-mkt-surface p-5",
              p.popular ? "border-mkt-primary shadow-[0_20px_60px_-30px_var(--mkt-glow)] lg:-my-3 lg:py-8" : "border-mkt-border",
            )}
          >
            {p.popular && (
              <span className="absolute -top-2.5 left-5">
                <Tag tone="accent">Most popular</Tag>
              </span>
            )}
            <p className="font-mkt-display text-[17px] font-semibold text-mkt-fg">{p.name}</p>
            <p className="mb-4 text-[11.5px] text-mkt-fg-muted">{p.sub}</p>
            <p className="mkt-num font-mkt-display text-[26px] font-semibold text-mkt-fg">
              {p.price}
              <span className="text-[12px] font-normal text-mkt-fg-muted"> / year</span>
            </p>
            <ul className="my-5 flex flex-1 flex-col gap-2">
              {p.feats.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[12.5px] text-mkt-fg-2">
                  <Check className="size-3.5 text-mkt-primary" /> {f}
                </li>
              ))}
              <li className="flex items-center gap-2 text-[12.5px] text-mkt-fg-2">
                <Check className="size-3.5 text-mkt-primary" /> All features included
              </li>
            </ul>
            <Btn variant={p.popular ? "primary" : "ghost"} size="sm" href="/signup">
              Start free trial
            </Btn>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11.5px] text-mkt-fg-muted">
        All plans billed annually, plus GST. <a href="/pricing" className="text-mkt-primary hover:underline">Full pricing page with a seat calculator →</a>
      </p>
    </Section>
  );
}
