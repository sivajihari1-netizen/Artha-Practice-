import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { createOrder } from "@/lib/razorpay";

const checkoutSchema = z.object({ planId: z.string() });

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role !== "PARTNER") {
    return NextResponse.json({ error: "Only Partners can manage billing" }, { status: 403 });
  }

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "planId is required" }, { status: 400 });

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const order = await createOrder({
    amountInPaise: Math.round(plan.priceAnnualInr * 1.18 * 100), // + 18% GST, in paise
    receipt: `firm_${auth.session.firmId}_${plan.id}_${Date.now()}`,
  });

  return NextResponse.json({ order, plan });
}
