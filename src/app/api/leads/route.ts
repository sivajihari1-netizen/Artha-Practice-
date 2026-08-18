import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  const leads = await prisma.lead.findMany({ where: { firmId: auth.session.firmId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  const parsed = createLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const lead = await prisma.lead.create({ data: { ...parsed.data, firmId: auth.session.firmId } });

  // Lead.notes is the existing context field (spec Step 13) — the activity
  // records that a note was present at creation, not the note text itself.
  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "LEAD",
    entityId: lead.id,
    eventType: ActivityEvent.LEAD_CREATED,
    title: `Lead created: ${lead.name}`,
    actorId: auth.session.userId,
    metadata: { stage: lead.stage, hasNotes: !!lead.notes },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
