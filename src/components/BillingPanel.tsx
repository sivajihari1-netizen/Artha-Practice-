"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";

type Plan = { id: string; name: string; priceAnnualInr: number; maxUsers: number; storageGb: number };

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BillingPanel({
  plans,
  currentPlanId,
  isStub,
}: {
  plans: Plan[];
  currentPlanId: string | null;
  isStub: boolean;
}) {
  const router = useRouter();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(planId: string) {
    setLoadingPlanId(planId);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    setLoadingPlanId(null);
    if (!res.ok) {
      setError(data.error ?? "Checkout failed");
      return;
    }

    if (data.order.stub) {
      alert(
        `Stub mode: no Razorpay keys configured yet.\n\nWould create a live order for ₹${(data.order.amount / 100).toLocaleString("en-IN")} for the ${data.plan.name} plan. Add RAZORPAY_KEY_ID/SECRET to .env to accept real payments.`
      );
      return;
    }

    const rzp = new window.Razorpay({
      key: data.order.key,
      amount: data.order.amount,
      currency: data.order.currency,
      order_id: data.order.id,
      name: "Artha",
      description: `${data.plan.name} plan — annual`,
      handler: function () {
        router.refresh();
      },
    });
    rzp.open();
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      {isStub && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2">
          Stub mode — RAZORPAY_KEY_ID/SECRET not set. Checkout will simulate the flow without charging anyone.
        </div>
      )}
      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p.id} className={`border rounded-xl p-5 bg-white ${p.id === currentPlanId ? "border-accent border-2" : "border-line"}`}>
            <h4 className="font-bold text-sm mb-1">{p.name}</h4>
            <div className="text-xl font-extrabold mb-1">₹{p.priceAnnualInr.toLocaleString("en-IN")}<span className="text-xs font-normal text-gray-500">/year + GST</span></div>
            <div className="text-xs text-gray-500 mb-4">{p.maxUsers} users · {p.storageGb} GB storage</div>
            {p.id === currentPlanId ? (
              <div className="text-xs font-semibold text-accent">Current Plan</div>
            ) : (
              <button
                onClick={() => subscribe(p.id)}
                disabled={loadingPlanId === p.id}
                className="w-full bg-ink text-white rounded-md py-2 text-xs font-semibold disabled:opacity-60"
              >
                {loadingPlanId === p.id ? "…" : "Subscribe"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
