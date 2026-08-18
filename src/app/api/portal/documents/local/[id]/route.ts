import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/clientPortalAuth";
import { getAccessibleClients } from "@/lib/clientPortalAccess";
import { readLocalFile } from "@/lib/storage";

// Portal-context counterpart to src/app/api/documents/local/[id]/route.ts —
// getDownloadUrl() in src/lib/storage.ts has two callers with two different
// session mechanisms (staff requireSession() vs. client-portal
// getPortalSession()), so fixing only the staff path would have silently
// broken every client-portal document download in local-storage mode. Same
// fix, same reasoning: only an opaque Document ID is accepted from the
// browser; the ownership check mirrors the existing one in
// src/app/api/portal/documents/[id]/download/route.ts exactly (never trust a
// client id from the request — always re-derive which clients this email
// may access); the actual filesystem key always comes from the database row.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document || !document.clientId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accessible = await getAccessibleClients(session.email);
  const authorized = accessible.some((c) => c.id === document.clientId);
  if (!authorized) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buffer = await readLocalFile(document.storageKey);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
