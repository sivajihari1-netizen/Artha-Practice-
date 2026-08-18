import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDownloadUrl } from "@/lib/storage";

// Returns a short-lived signed URL (S3) or a local dev proxy URL for the
// requested document, after checking the document belongs to the caller's firm.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const document = await prisma.document.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await getDownloadUrl(document.storageKey, document.id);
  return NextResponse.json({ url, fileName: document.fileName });
}
