import { Users, ListChecks, FolderCheck, ReceiptIndianRupee, GitCompareArrows, type LucideIcon } from "lucide-react";

// Single source of truth for the 5 product module depth pages — used by the
// /product hub listing and by each module's own cross-link strip, so the
// slug/name/tagline never drifts between the two.
export type Module = {
  slug: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
};

export const MODULES: Module[] = [
  { slug: "clients", name: "Clients", tagline: "One client. Everything connected.", icon: Users },
  { slug: "tasks", name: "Tasks", tagline: "Know what needs to happen before it's overdue.", icon: ListChecks },
  { slug: "documents", name: "Documents", tagline: "Stop chasing documents one client at a time.", icon: FolderCheck },
  { slug: "billing", name: "Billing", tagline: "From quotation to payment, without losing the thread.", icon: ReceiptIndianRupee },
  {
    slug: "reconciliation",
    name: "Reconciliation",
    tagline: "Stop checking GSTR-2B by eye.",
    icon: GitCompareArrows,
  },
];
