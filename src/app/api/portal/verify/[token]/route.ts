import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signPortalSession, setPortalSessionCookie } from "@/lib/clientPortalAuth";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const base = process.env.APP_URL || req.nextUrl.origin;
  const link = await prisma.clientPortalMagicLink.findUnique({ where: { token: params.token } });

  if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/portal/login?error=expired", base));
  }

  await prisma.clientPortalMagicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });

  const token = signPortalSession(link.email);
  setPortalSessionCookie(token);

  return NextResponse.redirect(new URL("/portal", base));
}
