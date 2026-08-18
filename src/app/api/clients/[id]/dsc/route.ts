import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

const createDscSchema = z.object({
  holderName: z.string().min(1),
  serialNo: z.string().optional(),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  location: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const parsed = createDscSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { issuedAt, expiresAt, ...rest } = parsed.data;

  const dsc = await prisma.dscRecord.create({
    data: {
      ...rest,
      clientId: client.id,
      issuedAt: issuedAt ? new Date(issuedAt) : undefined,
      expiresAt: new Date(expiresAt),
    },
  });
  return NextResponse.json({ dsc }, { status: 201 });
}
