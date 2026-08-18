import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BillingPanel from "@/components/BillingPanel";
import { isRazorpayConfigured } from "@/lib/razorpay";

export default async function BillingPage() {
  const session = getSession();
  const [firm, plans] = await Promise.all([
    prisma.firm.findUnique({ where: { id: session!.firmId }, include: { subscription: true } }),
    prisma.plan.findMany({ orderBy: { priceAnnualInr: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Billing</h1>
      <p className="text-sm text-gray-500 mb-2">
        Status: <span className="font-medium">{firm?.subscription?.status ?? "TRIALING"}</span>
        {firm?.subscription?.trialEndsAt && firm.subscription.status === "TRIALING" && (
          <> · trial ends {new Date(firm.subscription.trialEndsAt).toLocaleDateString("en-IN")}</>
        )}
        {firm?.subscription?.currentPeriodEnd && firm.subscription.status === "ACTIVE" && (
          <> · renews {new Date(firm.subscription.currentPeriodEnd).toLocaleDateString("en-IN")}</>
        )}
      </p>
      {plans.length === 0 ? (
        <div className="border border-line rounded-xl bg-white p-5 text-sm text-gray-500 mt-4">
          No plans seeded yet. Run <code className="bg-paper-dim px-1 rounded">npm run seed</code> to load the
          Solo/Starter/Growth/Scale/Enterprise plans.
        </div>
      ) : (
        <div className="mt-6">
          <BillingPanel plans={plans} currentPlanId={firm?.planId ?? null} isStub={!isRazorpayConfigured} />
        </div>
      )}
    </div>
  );
}
