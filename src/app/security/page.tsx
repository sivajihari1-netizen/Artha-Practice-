import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { SecurityBody } from "@/components/marketing/depth/SecurityBody";

export const metadata: Metadata = {
  title: "Security — Artha CA Practice Management",
  description:
    "Encrypted credentials, role-based access, isolated firm workspaces and secure sessions — what Artha actually enforces today.",
  alternates: { canonical: "https://arthapractice.in/security" },
};

export default function SecurityPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <SecurityBody />
      </DepthShell>
    </div>
  );
}
