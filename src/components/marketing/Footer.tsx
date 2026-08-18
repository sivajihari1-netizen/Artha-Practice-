// Every link below points at a real destination: a real page under
// src/app/**, an in-page anchor that actually exists on this page, or a
// verified mailto. "About", "Privacy", "Terms" and "Data security" have no
// real pages anywhere in this app — rendered as inert text rather than dead
// links, per explicit instruction not to fabricate navigation.
const PRODUCT: [string, string][] = [
  ["Clients", "/product/clients"],
  ["Tasks", "/product/tasks"],
  ["Documents", "/product/documents"],
  ["Billing", "/product/billing"],
  ["Reconciliation", "/product/reconciliation"],
];
const COMPANY: [string, string | null][] = [
  ["About", null],
  ["Security", "/security"],
  ["Contact", "mailto:arthaprofessional@gmail.com"],
];
const RESOURCES: [string, string][] = [
  ["How it works", "#connected"],
  ["FAQ", "#faq"],
  ["Pricing", "/pricing"],
];
const LEGAL: [string, string | null][] = [
  ["Privacy", null],
  ["Terms", null],
  ["Data security", null],
];

function LinkCol({ title, links }: { title: string; links: [string, string | null][] }) {
  return (
    <div>
      <p className="mkt-label-eyebrow mb-3 text-mkt-fg-muted">{title}</p>
      {links.map(([l, href]) =>
        href ? (
          <a key={l} href={href} className="block py-1 text-[12.5px] text-mkt-fg-muted transition-colors hover:text-mkt-fg">
            {l}
          </a>
        ) : (
          <span key={l} className="block cursor-default py-1 text-[12.5px] text-mkt-fg-muted/50" title="Coming soon">
            {l}
          </span>
        ),
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer id="footer" className="border-t border-mkt-border">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <p className="font-mkt-display text-[18px] font-semibold tracking-[-0.04em] text-mkt-fg">
            Artha<span className="text-mkt-primary">.</span>
          </p>
          <p className="mt-2 max-w-[28ch] text-[12.5px] text-mkt-fg-muted">
            Practice management software built for Indian CA firms.
          </p>
        </div>
        <LinkCol title="Product" links={PRODUCT} />
        <LinkCol title="Company" links={COMPANY} />
        <LinkCol title="Resources" links={RESOURCES} />
        <LinkCol title="Legal" links={LEGAL} />
      </div>
      <div className="border-t border-mkt-border py-5 text-center text-[11.5px] text-mkt-fg-muted">
        © 2026 Artha Financial Advisory
      </div>
    </footer>
  );
}
