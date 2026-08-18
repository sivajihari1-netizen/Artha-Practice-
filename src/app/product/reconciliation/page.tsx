import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { ReconciliationBody } from "@/components/marketing/depth/ProductBodies";

export const metadata: Metadata = {
  title: "Reconciliation — Artha CA Practice Management",
  description:
    "Upload GSTR-2B and your purchase register. Artha matches line by line, scores the risk, and turns every exception into an assigned task.",
  alternates: { canonical: "https://arthapractice.in/product/reconciliation" },
};

export default function ReconciliationProductPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <ReconciliationBody />
      </DepthShell>
    </div>
  );
}
