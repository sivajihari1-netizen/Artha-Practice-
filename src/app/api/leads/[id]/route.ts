import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const updateLeadSchema = z.object({
  stage: z.enum(["NEW", "CONTACTED", "PROPOSAL_SENT", "WON", "LOST"]).optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.lead.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const parsed = updateLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // A lead converts to a Client exactly once — the first time it's moved to
  // WON while convertedClientId is still unset. Re-saving an already-converted
  // lead (editing notes, or re-selecting WON after e.g. LOST) must never spin
  // up a second Client — convertedClientId, not a name match, is the source
  // of truth for "has this already converted," since two different leads can
  // legitimately share a name. Client creation and the Lead's own update
  // (stage/notes/convertedClientId) happen in one transaction so a failure
  // never leaves a Client created without its Lead linked, or a Lead marked
  // WON without a Client.
  const shouldConvert = parsed.data.stage === "WON" && !existing.convertedClientId;

  const lead = await prisma.$transaction(async (tx) => {
    if (!shouldConvert) {
      const updated = await tx.lead.update({ where: { id: params.id }, data: parsed.data });

      // Stage change and notes change get distinct events (spec Step 13) —
      // both can land in one PATCH, and each is independently meaningful.
      // Lead.notes text itself is never copied into Activity (Step 13/27):
      // the activity only records that a note-editing action happened.
      if (parsed.data.stage && parsed.data.stage !== existing.stage) {
        await recordActivity({
          db: tx,
          firmId: auth.session.firmId,
          entityType: "LEAD",
          entityId: updated.id,
          eventType: ActivityEvent.LEAD_STAGE_CHANGED,
          title: `Lead stage changed: ${existing.stage} → ${parsed.data.stage}`,
          actorId: auth.session.userId,
          metadata: { fromStage: existing.stage, toStage: parsed.data.stage },
        });
      }
      if (parsed.data.notes !== undefined && parsed.data.notes !== existing.notes) {
        await recordActivity({
          db: tx,
          firmId: auth.session.firmId,
          entityType: "LEAD",
          entityId: updated.id,
          eventType: ActivityEvent.LEAD_UPDATED,
          title: `Lead notes updated: ${existing.name}`,
          actorId: auth.session.userId,
          metadata: { changedFields: ["notes"] },
        });
      }
      return updated;
    }

    const client = await tx.client.create({ data: { firmId: auth.session.firmId, name: existing.name } });

    // Carry the Lead's phone/email into the new Client's Contact Person so
    // conversion doesn't immediately demand re-entering what's already on
    // file. Only when there's something to carry — a nameless, contactless
    // row would be worse than no row. This can only ever run once per lead:
    // the whole branch is gated by shouldConvert above, which requires
    // convertedClientId to still be unset, so there's no separate dedupe to
    // write here.
    if (existing.phone || existing.email) {
      await tx.contactPerson.create({
        data: {
          clientId: client.id,
          name: existing.name,
          phone: existing.phone,
          email: existing.email,
          isPrimary: true,
        },
      });
    }

    const updated = await tx.lead.update({
      where: { id: params.id },
      data: { ...parsed.data, convertedClientId: client.id },
    });

    // The new Client's own timeline should show it was created, same as any
    // other client (spec Step 11) — this path bypasses the clients API route
    // entirely, so nothing else would ever record CLIENT_CREATED for it.
    await recordActivity({
      db: tx,
      firmId: auth.session.firmId,
      entityType: "CLIENT",
      entityId: client.id,
      eventType: ActivityEvent.CLIENT_CREATED,
      title: `Client created: ${client.name}`,
      actorId: auth.session.userId,
      metadata: { convertedFromLeadId: existing.id },
    });
    await recordActivity({
      db: tx,
      firmId: auth.session.firmId,
      entityType: "LEAD",
      entityId: updated.id,
      eventType: ActivityEvent.LEAD_CONVERTED,
      title: `Lead converted: ${existing.name}`,
      actorId: auth.session.userId,
      metadata: { clientId: client.id },
    });

    return updated;
  });

  return NextResponse.json({ lead });
}
