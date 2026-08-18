import crypto from "crypto";
import { decryptSecret } from "@/lib/crypto";

/**
 * Per-firm Razorpay integration for collecting online invoice payments.
 *
 * This is deliberately separate from src/lib/razorpay.ts, which uses
 * ARTHA'S OWN Razorpay account to charge firms for their Artha subscription.
 * Here, each firm connects its OWN Razorpay account (its own keys, its own
 * settlement bank account) so that when a client pays an invoice, the money
 * goes straight to the firm — Artha never touches it and never could, since
 * we only ever call Razorpay's API using the firm's own credentials.
 */

type FirmRazorpayCreds = { keyId: string; keySecret: string };

export function getFirmRazorpayCreds(firm: { razorpayKeyId: string | null; razorpayKeySecretEnc: string | null }): FirmRazorpayCreds | null {
  if (!firm.razorpayKeyId || !firm.razorpayKeySecretEnc) return null;
  try {
    return { keyId: firm.razorpayKeyId, keySecret: decryptSecret(firm.razorpayKeySecretEnc) };
  } catch {
    return null;
  }
}

/**
 * Creates a Razorpay Payment Link for an invoice using the firm's own
 * account. We handle sending the link ourselves via email/WhatsApp, so
 * Razorpay's own SMS/email notifications are disabled to avoid double
 * notifying (and costing the firm extra).
 */
export async function createInvoicePaymentLink(params: {
  creds: FirmRazorpayCreds;
  invoiceId: string;
  invoiceNumber: string;
  amountInPaise: number;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
}): Promise<{ id: string; shortUrl: string }> {
  const Razorpay = (await import("razorpay")).default;
  const instance = new Razorpay({ key_id: params.creds.keyId, key_secret: params.creds.keySecret });

  const link = await instance.paymentLink.create({
    amount: params.amountInPaise,
    currency: "INR",
    accept_partial: false,
    description: `Invoice ${params.invoiceNumber}`,
    reference_id: params.invoiceId,
    customer: {
      name: params.customerName,
      email: params.customerEmail || undefined,
      contact: params.customerPhone || undefined,
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
  });

  return { id: link.id, shortUrl: link.short_url };
}

/** Verifies a Razorpay webhook signature against a specific firm's own webhook secret. */
export function verifyFirmWebhookSignature(rawBody: string, signature: string, webhookSecretEnc: string): boolean {
  let secret: string;
  try {
    secret = decryptSecret(webhookSecretEnc);
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}
