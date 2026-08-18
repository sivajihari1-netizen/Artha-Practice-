import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const resetSchema = z.object({ password: z.string().min(8, "Password must be at least 8 characters") });

/** Lets the reset-password page confirm the link is still valid before rendering the form. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const reset = await prisma.passwordResetToken.findUnique({ where: { token: params.token } });
  const valid = !!reset && !reset.usedAt && reset.expiresAt.getTime() > Date.now();
  return NextResponse.json({ valid });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = resetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const reset = await prisma.passwordResetToken.findUnique({ where: { token: params.token } });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding reset links for this user once one is used.
    prisma.passwordResetToken.updateMany({
      where: { userId: reset.userId, usedAt: null, id: { not: reset.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
