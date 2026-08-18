"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveQuotationInvoiceAction } from "@/lib/quotationInvoiceAction";

export default function QuotationActions({
  quotationId,
  status,
  hasEmail,
  hasPhone,
  shareLink,
  clientId,
  createdInvoice,
}: {
  quotationId: string;
  status: string;
  hasEmail: boolean;
  hasPhone: boolean;
  shareLink: string;
  /** Prospect-only quotations (no onboarded Client yet) can't be invoiced — "Create Invoice" never renders when this is null. */
  clientId: string | null;
  /** Set once this quotation already has an invoice (Invoice.sourceQuotationId) — swaps "Create Invoice" for a link to it instead of offering to create a second one. */
  createdInvoice: { id: string; invoiceNumber: string } | null;
}) {
  const router = useRouter();
  const invoiceAction = resolveQuotationInvoiceAction(status, clientId, createdInvoice?.id ?? null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function setStatus(next: string) {
    setLoading(next);
    await fetch(`/api/quotations/${quotationId}`, {
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
    const res = await fetch(`/api/quotations/${quotationId}/${channel}`, { method: "POST" });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? `Failed to send via ${label}`);
      setMessageIsError(true);
      return;
    }
    setMessage(`Quotation sent via ${label}.`);
    setMessageIsError(false);
    router.refresh();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function createInvoice() {
    setLoading("create-invoice");
    setMessage(null);
    const res = await fetch(`/api/quotations/${quotationId}/create-invoice`, { method: "POST" });
    if (!res.ok) {
      setLoading(null);
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Could not create invoice");
      setMessageIsError(true);
      return;
    }
    const data = await res.json();
    router.push(`/dashboard/invoices/${data.invoice.id}`);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center">
        <a href={`/api/quotations/${quotationId}/pdf`} target="_blank" rel="noopener noreferrer" className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim">
          Download PDF
        </a>
        <button onClick={copyLink} className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim">
          {copied ? "Link Copied!" : "Copy Share Link"}
        </button>
        <button
          onClick={() => sendVia("send", "email")}
          disabled={loading !== null || !hasEmail}
          title={hasEmail ? undefined : "No email on file"}
          className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim disabled:opacity-50"
        >
          {loading === "send" ? "Sending…" : "Email to Client"}
        </button>
        <button
          onClick={() => sendVia("whatsapp", "WhatsApp")}
          disabled={loading !== null || !hasPhone}
          title={hasPhone ? undefined : "No phone number on file"}
          className="border border-line rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim disabled:opacity-50"
        >
          {loading === "whatsapp" ? "Sending…" : "Send via WhatsApp"}
        </button>
        {status === "DRAFT" && (
          <button onClick={() => setStatus("SENT")} disabled={loading !== null} className="border border-accent text-accent rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading === "SENT" ? "Marking…" : "Mark as Sent"}
          </button>
        )}
        {(status === "SENT" || status === "DRAFT") && (
          <button onClick={() => setStatus("EXPIRED")} disabled={loading !== null} className="border border-red-300 text-red-600 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading === "EXPIRED" ? "Marking…" : "Mark as Expired"}
          </button>
        )}
        {invoiceAction === "view" && createdInvoice && (
          <a
            href={`/dashboard/invoices/${createdInvoice.id}`}
            className="border border-accent text-accent rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-paper-dim"
          >
            View Invoice →
          </a>
        )}
        {invoiceAction === "create" && (
          <button
            onClick={createInvoice}
            disabled={loading !== null}
            className="border border-accent text-accent rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {loading === "create-invoice" ? "Creating…" : "Create Invoice"}
          </button>
        )}
      </div>
      {message && <p className={`text-xs mt-2 ${messageIsError ? "text-red-600" : "text-accent"}`}>{message}</p>}
    </div>
  );
}
