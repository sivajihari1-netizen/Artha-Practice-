"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Btn, Eyebrow, Section } from "../primitives";
import { Client360, Kanban, DocRequest, Billing } from "../Stories";
import { Reconciliation } from "../Reconciliation";
import { MODULES } from "./moduleData";

// Cross-link strip shown at the bottom of every module page and the hub —
// real routes only (each slug maps to an actual page.tsx under src/app/product).
function OtherModules({ exclude }: { exclude?: string }) {
  const rest = MODULES.filter((m) => m.slug !== exclude);
  return (
    <Section pad="tight" rule>
      <p className="mkt-label-eyebrow mb-4 text-mkt-fg-muted">Explore the rest of Artha</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rest.map((m) => (
          <a
            key={m.slug}
            href={`/product/${m.slug}`}
            className="rounded-xl border border-mkt-border bg-mkt-surface p-4 transition-colors hover:border-mkt-border-hi hover:bg-mkt-surface-2"
          >
            <m.icon className="mb-2 size-4 text-mkt-primary" />
            <p className="text-[13px] font-medium text-mkt-fg">{m.name}</p>
          </a>
        ))}
      </div>
    </Section>
  );
}

function ModuleHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <Section pad="tight">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="font-mkt-display max-w-[20ch] text-[clamp(2rem,4vw,2.9rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] text-mkt-fg-muted">{body}</p>
      <div className="mt-6">
        <Btn href="/signup">
          Start 30-Day Free Trial <ArrowRight className="size-4" />
        </Btn>
      </div>
    </Section>
  );
}

function PointsPanel({ points, visual }: { points: string[]; visual: React.ReactNode }) {
  return (
    <Section pad="tight">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-center lg:gap-14">
        <ul className="flex flex-col gap-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[14.5px] text-mkt-fg-2">
              <Check className="mt-1 size-[15px] shrink-0 text-mkt-primary" />
              {p}
            </li>
          ))}
        </ul>
        <div>{visual}</div>
      </div>
    </Section>
  );
}

export function ProductHubBody() {
  return (
    <>
      <Section pad="tight">
        <Eyebrow>Product</Eyebrow>
        <h1 className="font-mkt-display max-w-[18ch] text-[clamp(2rem,4vw,2.9rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
          Five modules. One record. No re-entry.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] text-mkt-fg-muted">
          Clients, tasks, documents, billing and reconciliation all read from the same client
          record — nothing lives twice, and nothing has to be typed twice.
        </p>
      </Section>
      <Section pad="tight">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <a
              key={m.slug}
              href={`/product/${m.slug}`}
              className="group rounded-2xl border border-mkt-border bg-mkt-surface p-6 transition-colors hover:border-mkt-border-hi hover:bg-mkt-surface-2"
            >
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-[var(--mkt-wash)] text-mkt-primary">
                <m.icon className="size-[18px]" />
              </span>
              <p className="font-mkt-display text-[17px] font-semibold text-mkt-fg">{m.name}</p>
              <p className="mt-1.5 text-[13.5px] text-mkt-fg-muted">{m.tagline}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-mkt-primary opacity-0 transition-opacity group-hover:opacity-100">
                Explore <ArrowRight className="size-3.5" />
              </span>
            </a>
          ))}
        </div>
      </Section>
    </>
  );
}

export function ClientsBody() {
  return (
    <>
      <ModuleHeader
        eyebrow="Product / Clients"
        title="One client. Everything connected."
        body="Every task, invoice, document and exception for a client sits on one screen — no switching, no separate registers."
      />
      <PointsPanel
        points={[
          "GSTIN, PAN and contact details on the record itself",
          "Tasks, invoices, documents and reconciliation in tabs",
          "Full activity log of who did what, and when",
        ]}
        visual={<Client360 />}
      />
      <OtherModules exclude="clients" />
    </>
  );
}

export function TasksBody() {
  return (
    <>
      <ModuleHeader
        eyebrow="Product / Tasks"
        title="Know what needs to happen. Before it becomes overdue."
        body="Recurring compliance work creates itself. Everything sits on a board with owner, due date and priority."
      />
      <PointsPanel
        points={[
          "Kanban across To do, In progress, Review and Done",
          "Recurring GST, TDS and ITR work auto-created",
          "Workload visible per team member",
        ]}
        visual={<Kanban />}
      />
      <OtherModules exclude="tasks" />
    </>
  );
}

export function DocumentsBody() {
  return (
    <>
      <ModuleHeader
        eyebrow="Product / Documents"
        title="Stop chasing documents one client at a time."
        body="Raise one request, let Artha remind the client on WhatsApp and email, and track what's still missing."
      />
      <PointsPanel
        points={[
          "Checklist-based requests per client",
          "Automated WhatsApp and email reminders",
          "Request → reminder → received → verified, tracked",
        ]}
        visual={<DocRequest />}
      />
      <OtherModules exclude="documents" />
    </>
  );
}

export function BillingBody() {
  return (
    <>
      <ModuleHeader
        eyebrow="Product / Billing"
        title="From quotation to payment, without losing the thread."
        body="Quotations convert into invoices, invoices carry their real status, and outstanding is always current."
      />
      <PointsPanel
        points={[
          "Statuses you already use: Draft, Sent, Paid, Overdue",
          "Quotation converts to invoice in one step",
          "Outstanding rolls up to the dashboard",
        ]}
        visual={<Billing />}
      />
      <OtherModules exclude="billing" />
    </>
  );
}

export function ReconciliationBody() {
  const router = useRouter();
  return (
    <>
      <Section pad="tight">
        <Eyebrow>Product / Reconciliation</Eyebrow>
      </Section>
      {/* The full walkthrough modal only exists on the homepage, so this CTA
          takes the visitor there rather than opening a dead/no-op modal. */}
      <Reconciliation onWatch={() => router.push("/#top")} />
      <OtherModules exclude="reconciliation" />
    </>
  );
}
