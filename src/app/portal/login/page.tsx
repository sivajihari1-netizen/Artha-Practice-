"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function PortalLoginForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("error") === "expired";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <>
      {expired && !sent && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          That link has expired or was already used. Request a new one below.
        </div>
      )}

      {sent ? (
        <p className="text-sm text-accent font-medium">
          If that email is on file with your CA firm, we&apos;ve sent a sign-in link. Check your inbox — it expires in 15 minutes.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Email Address</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-line rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {loading ? "Sending…" : "Send Sign-In Link"}
          </button>
        </form>
      )}
    </>
  );
}

export default function PortalLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm border border-line rounded-xl p-8 bg-white">
        <div className="text-2xl font-extrabold mb-1">
          Artha<span className="text-accent">.</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Client Portal — check your compliance status and documents.</p>
        <Suspense fallback={null}>
          <PortalLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
