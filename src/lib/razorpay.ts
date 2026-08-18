import crypto from "crypto";

const configured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/**
 * Creates a Razorpay order for a one-time annual plan payment. In stub mode
 * (no RAZORPAY_KEY_ID/SECRET) this returns a fake order so the UI flow can
 * be built/tested end-to-end before you have real Razorpay keys.
 *
 * Real integration: sign up at razorpay.com, get API keys, add them to
 * .env, and this switches to live orders automatically. On the client,
 * open Razorpay Checkout with the returned order id; on success, Razorpay
 * calls your webhook (see verifyWebhookSignature below) to confirm payment
 * server-side — never trust the client-side success callback alone.
 */
export async function createOrder(params: { amountInPaise: number; receipt: string }) {
  if (!configured) {
    return {
      stub: true,
      id: `order_stub_${Date.now()}`,
      amount: params.amountInPaise,
      currency: "INR",
      key: "rzp_stub_key",
    };
  }

  const Razorpay = (await import("razorpay")).default;
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  const order = await instance.orders.create({
    amount: params.amountInPaise,
    currency: "INR",
    receipt: params.receipt,
  });
  return { stub: false, ...order, key: process.env.RAZORPAY_KEY_ID };
}

/** Verifies the `X-Razorpay-Signature` header on incoming webhook requests. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

export const isRazorpayConfigured = configured;
