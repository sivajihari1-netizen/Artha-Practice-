import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { encryptSecret } from "@/lib/crypto";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const updateFirmSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIfsc: z.string().optional(),
  upiId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  showCaTagline: z.boolean().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #0F766E").optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  razorpayWebhookSecret: z.string().optional(),
});

// razorpayKeySecretEnc / razorpayWebhookSecretEnc are never selected here — once
// set, they're write-only from the client's perspective.
const FIRM_SELECT = {
  id: true, name: true, city: true, gstin: true, pan: true, address: true,
  bankName: true, bankAccountName: true, bankAccountNo: true, bankIfsc: true, upiId: true,
  phone: true, email: true, website: true, showCaTagline: true, brandColor: true,
  razorpayKeyId: true, razorpayKeySecretEnc: true, razorpayWebhookSecretEnc: true,
};

function withRazorpayFlags<T extends { razorpayKeySecretEnc: string | null; razorpayWebhookSecretEnc: string | null }>(firm: T) {
  const { razorpayKeySecretEnc, razorpayWebhookSecretEnc, ...rest } = firm;
  return { ...rest, razorpayKeySecretSet: !!razorpayKeySecretEnc, razorpayWebhookSecretSet: !!razorpayWebhookSecretEnc };
}

export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const firm = await prisma.firm.findUnique({ where: { id: auth.session.firmId }, select: FIRM_SELECT });
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ firm: withRazorpayFlags(firm) });
}

export async function PATCH(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role !== "PARTNER") {
    return NextResponse.json({ error: "Only Partners can edit firm details" }, { status: 403 });
  }

  const parsed = updateFirmSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { razorpayKeySecret, razorpayWebhookSecret, ...rest } = parsed.data;

  const firm = await prisma.firm.update({
    where: { id: auth.session.firmId },
    data: {
      ...rest,
      razorpayKeySecretEnc: razorpayKeySecret ? encryptSecret(razorpayKeySecret) : undefined,
      razorpayWebhookSecretEnc: razorpayWebhookSecret ? encryptSecret(razorpayWebhookSecret) : undefined,
    },
    select: FIRM_SELECT,
  });

  // Never put secret values in metadata — only which fields changed, plus a
  // non-secret "was a Razorpay secret set" flag for the two write-only ones.
  const changedFields = [
    ...Object.keys(rest),
    ...(razorpayKeySecret ? ["razorpayKeySecret"] : []),
    ...(razorpayWebhookSecret ? ["razorpayWebhookSecret"] : []),
  ];
  if (changedFields.length > 0) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "FIRM",
      entityId: auth.session.firmId,
      eventType: ActivityEvent.FIRM_UPDATED,
      title: `Firm settings updated: ${changedFields.join(", ")}`,
      actorId: auth.session.userId,
      metadata: { changedFields },
    });
  }

  return NextResponse.json({ firm: withRazorpayFlags(firm) });
}
