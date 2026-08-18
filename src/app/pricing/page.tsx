import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { PricingBody } from "@/components/marketing/depth/PricingBody";

export const metadata: Metadata = {
  title: "Pricing — Artha CA Practice Management",
  description:
    "Solo ₹1,000, Starter ₹7,500, Growth ₹12,500, Scale ₹17,000, Enterprise ₹27,000 per year. Every plan includes every feature. Use the seat calculator to find your tier.",
  alternates: { canonical: "https://arthapractice.in/pricing" },
};

export default function PricingPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <PricingBody />
      </DepthShell>
    </div>
  );
}
