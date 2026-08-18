import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateMagicLinkToken, magicLinkExpiry } from "@/lib/clientPortalAuth";
import { sendEmail } from "@/lib/email";

const loginSchema = z.object({ email: z.string().email() });

/**
 * Always responds with the same generic message regardless of whether the
 * email matches a client contact — avoids leaking which emails are clients
 * of which firms (email enumeration).
 */
export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const contact = await prisma.contactPerson.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

  if (contact) {
    const token = generateMagicLinkToken();
    await prisma.clientPortalMagicLink.create({
      data: { email, token, expiresAt: magicLinkExpiry() },
    });
    const link = `${process.env.APP_URL ?? "https://arthapractice.in"}/portal/verify/${token}`;
    const result = await sendEmail({
      to: email,
      subject: "Your Artha client portal sign-in link",
      body: `<p>Click the link below to access your document and compliance status portal. This link expires in 15 minutes and can only be used once.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
    // Server-side visibility only — the HTTP response below stays identical
    // either way so this can never be used to enumerate portal contacts.
    if (!result.ok) {
      console.error(`[portal-login] sendEmail failed for contactId=${contact.id}`);
    }
  }

  return NextResponse.json({ ok: true, message: "If that email is on file, we've sent a sign-in link." });
}
