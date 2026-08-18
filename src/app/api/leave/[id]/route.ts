import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

const updateLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can approve leave" }, { status: 403 });
  }

  const existing = await prisma.leaveRequest.findFirst({
    where: { id: params.id, user: { firmId: auth.session.firmId } },
  });
  if (!existing) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

  const parsed = updateLeaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const request = await prisma.leaveRequest.update({ where: { id: params.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ request });
}
