import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/clientPortalAuth";
import { getAccessibleClients, PORTAL_ACTIVE_CLIENT_COOKIE } from "@/lib/clientPortalAccess";

export async function POST(req: NextRequest) {
  const session = getPortalSession();
  const base = process.env.APP_URL || req.nextUrl.origin;
  if (!session) return NextResponse.redirect(new URL("/portal/login", base));

  const formData = await req.formData();
  const clientId = formData.get("clientId") as string | null;
  const next = (formData.get("next") as string | null) || "/portal";

  const accessible = await getAccessibleClients(session.email);
  if (clientId && accessible.some((c) => c.id === clientId)) {
    cookies().set(PORTAL_ACTIVE_CLIENT_COOKIE, clientId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }

  return NextResponse.redirect(new URL(next, base));
}
