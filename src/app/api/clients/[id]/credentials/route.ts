import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { encryptSecret } from "@/lib/crypto";

const createCredentialSchema = z.object({
  label: z.string().min(1, "Label is required (e.g. GST Portal)"),
  username: z.string().optional(),
  secret: z.string().min(1, "Password/secret is required"),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { label, username, secret, expiresAt } = parsed.data;
  const credential = await prisma.credential.create({
    data: {
      clientId: client.id,
      label,
      username,
      secretEnc: encryptSecret(secret),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    },
    select: { id: true, label: true, username: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ credential }, { status: 201 });
}
