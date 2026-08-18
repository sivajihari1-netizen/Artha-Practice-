import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { ProductHubBody } from "@/components/marketing/depth/ProductBodies";

export const metadata: Metadata = {
  title: "Product — Artha CA Practice Management",
  description:
    "Clients, tasks, documents, billing and GST reconciliation — five connected modules built for Indian CA firms.",
  alternates: { canonical: "https://arthapractice.in/product" },
};

export default function ProductPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <ProductHubBody />
      </DepthShell>
    </div>
  );
}
