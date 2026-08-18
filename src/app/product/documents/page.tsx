import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { DocumentsBody } from "@/components/marketing/depth/ProductBodies";

export const metadata: Metadata = {
  title: "Documents — Artha CA Practice Management",
  description:
    "Checklist-based document requests with automated WhatsApp and email reminders, tracked request to verified.",
  alternates: { canonical: "https://arthapractice.in/product/documents" },
};

export default function DocumentsProductPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <DocumentsBody />
      </DepthShell>
    </div>
  );
}
