import Link from "next/link";

// Plain server-rendered links — the only "way back to Reconciliation
// overview / Run history" navigation F2 needs (F2.3). Deliberately not a
// full nav overhaul: 3 short labels, no icons, no dropdowns. `active` is
// passed explicitly by each page rather than derived from usePathname, so
// this stays a hook-free component that F1's existing page tree-walking
// test helpers can expand without a "use client" boundary.
const ITEMS: { key: "exceptions" | "runs" | "upload"; href: string; label: string }[] = [
  { key: "exceptions", href: "/dashboard/reconciliation", label: "Exceptions" },
  { key: "runs", href: "/dashboard/reconciliation/runs", label: "Runs" },
  { key: "upload", href: "/dashboard/reconciliation/upload", label: "Upload" },
];

// F2 Security Refinement: the Upload tab is a meaningful financial/compliance
// action (starts a reconciliation run), so it's dropped from the strip
// entirely for STAFF — not shown disabled, not shown with an explanatory
// "no permission" label, matching the explicit instruction that STAFF should
// have no obvious UI path to it. Runs/Exceptions stay visible to everyone;
// STAFF retains full view access to both.
export default function ReconciliationSubNav({
  active,
  canManageReconciliation,
}: {
  active: "exceptions" | "runs" | "upload";
  canManageReconciliation: boolean;
}) {
  const items = canManageReconciliation ? ITEMS : ITEMS.filter((item) => item.key !== "upload");
  return (
    <div className="flex items-center gap-4 mb-4 border-b border-line pb-2">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`text-sm font-semibold pb-2 -mb-2.5 border-b-2 ${
            item.key === active ? "text-accent border-accent" : "text-gray-500 border-transparent hover:text-charcoal"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
