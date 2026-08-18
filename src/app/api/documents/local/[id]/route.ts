import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { readLocalFile } from "@/lib/storage";

// Replaces the old src/app/api/documents/local/[...key]/route.ts, which
// accepted a browser-supplied filesystem-shaped key and only checked that it
// *started with* the caller's firmId — a confirmed path-traversal
// vulnerability (proven via direct reproduction: `../../` and its
// URL-encoded form both escaped the uploads root). This route accepts only
// an opaque Document ID; the actual filesystem key always comes from the
// database row, never from the request. See src/lib/storage.ts's
// readLocalFile() for the second, independent containment check.
//
// Only used in local-disk fallback mode (no S3 configured) — mirrors the
// same ownership check as /api/documents/[id]/download.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const document = await prisma.document.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buffer = await readLocalFile(document.storageKey);
    // Buffer satisfies BodyInit at runtime (Next.js accepts any ArrayBufferView);
    // the cast works around a @types/node/TS-lib generic-Uint8Array mismatch.
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
