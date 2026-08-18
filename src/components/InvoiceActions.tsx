"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceActions({
  invoiceId,
  status,
  clientEmail,
  clientPhone,
  shareLink,
  razorpayConnected,
}: {
  invoiceId: string;
  status: string;
  clientEmail: string | null;
  clientPhone: string | null;
  shareLink: string;
  razorpayConnected: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payLinkCopied, setPayLinkCopied] = useState(false);

  async function setStatus(next: string) {
    setLoading(next);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(null);
    router.refresh();
  }

  async function sendVia(channel: "send" | "whatsapp", label: string) {
    setLoading(channel);
    setMessage(null);
    const res = await fetch(`/api/invoices/${invoiceId}/${channel}`, { method: "POST" });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? `Failed to send via ${label}`);
      setMessageIsError(true);
      return;
    }
    setMessage(`Invoice sent via ${label}.`);
    setMessageIsError(false);
    router.refresh();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyPaymentLink() {
    setLoading("payment-link");
    setMessage(null);
    const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, { method: "POST" });
    setLoading(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Failed to generate payment link");
      setMessageIsError(true);
      return;
    }
    await navigator.clipboard.writeText(data.url);
    setPayLinkCopied(true);
    setTimeout(() => setPayLinkCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center">
        <a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer" className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim">
          Download PDF
        </a>
        <button onClick={copyLink} className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim">
          {copied ? "Link Copied!" : "Copy Share Link"}
        </button>
        {razorpayConnected && status !== "DRAFT" && status !== "CANCELLED" && status !== "PAID" && (
          <button onClick={copyPaymentLink} disabled={loading !== null} className="border border-inv-primary text-inv-primary rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-inv-secondary disabled:opacity-50">
            {loading === "payment-link" ? "Generating…" : payLinkCopied ? "Payment Link Copied!" : "Copy Payment Link"}
          </button>
        )}
        <button
          onClick={() => sendVia("send", "email")}
          disabled={loading !== null || !clientEmail}
          title={clientEmail ? undefined : "Add a client contact with an email address first"}
          className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim disabled:opacity-50"
        >
          {loading === "send" ? "Sending…" : "Email to Client"}
        </button>
        <button
          onClick={() => sendVia("whatsapp", "WhatsApp")}
          disabled={loading !== null || !clientPhone}
          title={clientPhone ? undefined : "Add a client contact with a phone number first"}
          className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim disabled:opacity-50"
        >
          {loading === "whatsapp" ? "Sending…" : "Send via WhatsApp"}
        </button>
        {status === "DRAFT" && (
          <button onClick={() => setStatus("SENT")} disabled={loading !== null} className="border border-accent text-accent rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading === "SENT" ? "Marking…" : "Mark as Sent"}
          </button>
        )}
        {(status === "SENT" || status === "OVERDUE") && (
          <button onClick={() => setStatus("PAID")} disabled={loading !== null} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading === "PAID" ? "Marking…" : "Mark as Paid"}
          </button>
        )}
        {status !== "PAID" && status !== "CANCELLED" && (
          <button onClick={() => setStatus("CANCELLED")} disabled={loading !== null} className="border border-red-300 text-red-600 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading === "CANCELLED" ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
      {message && <p className={`text-xs mt-2 ${messageIsError ? "text-red-600" : "text-accent"}`}>{message}</p>}
    </div>
  );
}
