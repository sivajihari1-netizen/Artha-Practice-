import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { decryptSecret } from "@/lib/crypto";
import { logAudit } from "@/lib/auditLog";

// Reveals a decrypted credential secret. Restricted to PARTNER/MANAGER —
// staff members should request access rather than view client portal
// passwords directly. Every reveal is recorded in the audit log.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can reveal credentials" }, { status: 403 });
  }

  const credential = await prisma.credential.findFirst({
    where: { id: params.id, client: { firmId: auth.session.firmId } },
  });
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const secret = decryptSecret(credential.secretEnc);

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "credential.reveal",
    targetType: "Credential",
    targetId: credential.id,
    metadata: { label: credential.label, clientId: credential.clientId },
  });

  return NextResponse.json({ secret });
}
