"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Firm = {
  name: string;
  city: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  showCaTagline: boolean;
  brandColor: string;
  razorpayKeyId: string | null;
  razorpayKeySecretSet: boolean;
  razorpayWebhookSecretSet: boolean;
};

export default function FirmSettingsForm({ firm, canEdit, webhookUrl }: { firm: Firm; canEdit: boolean; webhookUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState(firm.name);
  const [city, setCity] = useState(firm.city ?? "");
  const [gstin, setGstin] = useState(firm.gstin ?? "");
  const [pan, setPan] = useState(firm.pan ?? "");
  const [address, setAddress] = useState(firm.address ?? "");
  const [phone, setPhone] = useState(firm.phone ?? "");
  const [email, setEmail] = useState(firm.email ?? "");
  const [website, setWebsite] = useState(firm.website ?? "");
  const [bankName, setBankName] = useState(firm.bankName ?? "");
  const [bankAccountName, setBankAccountName] = useState(firm.bankAccountName ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(firm.bankAccountNo ?? "");
  const [bankIfsc, setBankIfsc] = useState(firm.bankIfsc ?? "");
  const [upiId, setUpiId] = useState(firm.upiId ?? "");
  const [showCaTagline, setShowCaTagline] = useState(firm.showCaTagline);
  const [brandColor, setBrandColor] = useState(firm.brandColor);
  const [razorpayKeyId, setRazorpayKeyId] = useState(firm.razorpayKeyId ?? "");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/firm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, city: city || undefined, gstin: gstin || undefined, pan: pan || undefined, address: address || undefined,
        phone: phone || undefined, email: email || undefined, website: website || undefined,
        bankName: bankName || undefined, bankAccountName: bankAccountName || undefined,
        bankAccountNo: bankAccountNo || undefined, bankIfsc: bankIfsc || undefined, upiId: upiId || undefined,
        showCaTagline,
        brandColor,
        razorpayKeyId: razorpayKeyId || undefined,
        razorpayKeySecret: razorpayKeySecret || undefined,
        razorpayWebhookSecret: razorpayWebhookSecret || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white space-y-3 max-w-lg">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {saved && <div className="text-sm text-accent bg-accent-light border border-line rounded-md px-3 py-2">Saved.</div>}
      <p className="text-xs text-gray-500">
        These details appear on the letterhead of invoices you raise to clients. GSTIN is required to charge GST on
        invoices.
      </p>
      <div>
        <label className="block text-xs font-medium mb-1">Firm Name</label>
        <input disabled={!canEdit} required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">City</label>
          <input disabled={!canEdit} value={city} onChange={(e) => setCity(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">GSTIN</label>
          <input disabled={!canEdit} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="e.g. 27AAAAA0000A1Z5" className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">PAN</label>
        <input disabled={!canEdit} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Address</label>
        <textarea disabled={!canEdit} value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Phone</label>
          <input disabled={!canEdit} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Contact Email</label>
          <input disabled={!canEdit} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="firm@example.com" className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Website</label>
        <input disabled={!canEdit} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.example.com" className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={!canEdit} checked={showCaTagline} onChange={(e) => setShowCaTagline(e.target.checked)} />
        Show &quot;Chartered Accountants&quot; under the firm name on invoices
      </label>

      <div>
        <label className="block text-xs font-medium mb-1">Brand Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color" disabled={!canEdit} value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
            className="w-10 h-9 border border-line rounded-md p-0.5 disabled:opacity-60"
          />
          <input
            disabled={!canEdit} value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
            className="w-28 border border-line rounded-md px-3 py-2 text-sm font-mono disabled:bg-paper-dim"
          />
          <p className="text-xs text-gray-400">Used across invoices and quotations.</p>
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <p className="text-xs font-semibold mb-2">Bank &amp; UPI Details (shown on invoice PDFs)</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Account Holder Name</label>
            <input disabled={!canEdit} value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Bank Name</label>
              <input disabled={!canEdit} value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">IFSC</label>
              <input disabled={!canEdit} value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Account Number</label>
            <input disabled={!canEdit} value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">UPI ID</label>
            <input disabled={!canEdit} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="firmname@okhdfcbank" className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
            <p className="text-xs text-gray-400 mt-1">Invoices will show a scannable QR code so clients can pay instantly via any UPI app.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <p className="text-xs font-semibold mb-1">Online Payments (Razorpay)</p>
        <p className="text-xs text-gray-500 mb-2">
          Connect your own Razorpay account so clients can pay invoices online by card, netbanking, or UPI.
          Payments settle directly to your bank account — Artha never holds or touches the money.
          Don&apos;t have one? Sign up free at{" "}
          <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">razorpay.com</a>.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Key ID</label>
            <input disabled={!canEdit} value={razorpayKeyId} onChange={(e) => setRazorpayKeyId(e.target.value)} placeholder="rzp_live_…" className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Key Secret</label>
            <input
              disabled={!canEdit} type="password" value={razorpayKeySecret} onChange={(e) => setRazorpayKeySecret(e.target.value)}
              placeholder={firm.razorpayKeySecretSet ? "•••••••••••• (saved — enter a new value to replace)" : "From your Razorpay Dashboard > Settings > API Keys"}
              className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Webhook URL <span className="text-gray-400 font-normal">(paste this into Razorpay Dashboard &gt; Settings &gt; Webhooks)</span></label>
            <input readOnly value={webhookUrl} onFocus={(e) => e.target.select()} className="w-full border border-line rounded-md px-3 py-2 text-sm bg-paper-dim font-mono text-xs" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Webhook Secret <span className="text-gray-400 font-normal">(shown when you create the webhook above; subscribe to the &quot;payment_link.paid&quot; event)</span></label>
            <input
              disabled={!canEdit} type="password" value={razorpayWebhookSecret} onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
              placeholder={firm.razorpayWebhookSecretSet ? "•••••••••••• (saved — enter a new value to replace)" : "Paste the webhook secret from Razorpay"}
              className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim"
            />
          </div>
        </div>
      </div>

      {canEdit ? (
        <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {loading ? "Saving…" : "Save"}
        </button>
      ) : (
        <p className="text-xs text-gray-400">Only Partners can edit firm details.</p>
      )}
    </form>
  );
}
