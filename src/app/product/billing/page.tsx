import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { BillingBody } from "@/components/marketing/depth/ProductBodies";

export const metadata: Metadata = {
  title: "Billing — Artha CA Practice Management",
  description:
    "Quotations convert into invoices, invoices carry their real status, and outstanding always rolls up to the dashboard.",
  alternates: { canonical: "https://arthapractice.in/product/billing" },
};

export default function BillingProductPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <BillingBody />
      </DepthShell>
    </div>
  );
}
