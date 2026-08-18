import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateResetToken, resetTokenExpiry } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const forgotSchema = z.object({ email: z.string().email() });

/**
 * Always responds with the same generic message regardless of whether the
 * email matches a staff account — avoids leaking which emails have an Artha
 * login (email enumeration). Mirrors the client-portal magic-link flow in
 * src/app/api/portal/login/route.ts.
 */
export async function POST(req: NextRequest) {
  const parsed = forgotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.active) {
    const token = generateResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: resetTokenExpiry() },
    });
    const link = `${process.env.APP_URL ?? "https://arthapractice.in"}/reset-password/${token}`;
    const result = await sendEmail({
      to: email,
      subject: "Reset your Artha password",
      body: `<p>We received a request to reset your Artha password. Click the link below to choose a new one. This link expires in 30 minutes and can only be used once.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can safely ignore this email — your password won't be changed.</p>`,
      firmId: user.firmId,
    });
    // Server-side visibility only — the HTTP response below stays identical
    // either way so this can never be used to enumerate accounts.
    if (!result.ok) {
      console.error(`[forgot-password] sendEmail failed for userId=${user.id}`);
    }
  }

  return NextResponse.json({ ok: true, message: "If that email has an Artha account, we've sent a password reset link." });
}
