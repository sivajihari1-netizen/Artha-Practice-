import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/clientPortalAuth";
import { getAccessibleClients } from "@/lib/clientPortalAccess";
import { getDownloadUrl } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document || !document.clientId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Never trust a client id from the request — always re-derive which clients this email may access.
  const accessible = await getAccessibleClients(session.email);
  const authorized = accessible.some((c) => c.id === document.clientId);
  if (!authorized) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await getDownloadUrl(document.storageKey, document.id, true);
  return NextResponse.json({ url, fileName: document.fileName });
}
