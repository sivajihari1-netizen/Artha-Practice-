import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

/**
 * Minimal "where am I / how did I get here" trail (IA finalization, Step 7)
 * — only added to pages that already have a real parent→child relationship
 * (a list page leading to a detail page). Not applied everywhere; most pages
 * in this app are flat top-level destinations with nothing to trail from.
 */
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-accent font-medium">
              {item.label}
            </Link>
          ) : (
            <span className="text-charcoal font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
