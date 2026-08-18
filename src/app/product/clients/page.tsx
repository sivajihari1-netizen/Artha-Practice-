import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { ClientsBody } from "@/components/marketing/depth/ProductBodies";

export const metadata: Metadata = {
  title: "Clients — Artha CA Practice Management",
  description:
    "One client record with GSTIN, PAN, contact, tasks, invoices, documents and reconciliation — no switching, no separate registers.",
  alternates: { canonical: "https://arthapractice.in/product/clients" },
};

export default function ClientsProductPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <ClientsBody />
      </DepthShell>
    </div>
  );
}
