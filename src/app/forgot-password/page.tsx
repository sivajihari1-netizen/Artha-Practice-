"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-line rounded-xl p-8 bg-white">
        <div className="text-2xl font-extrabold mb-1">
          Artha<span className="text-accent">.</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Reset your password</p>

        {sent ? (
          <p className="text-sm text-accent font-medium">
            If that email has an Artha account, we&apos;ve sent a password reset link. Check your inbox — it expires in 30 minutes.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm"
                placeholder="you@firm.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-white rounded-md py-2 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-accent font-medium">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
