import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/apiAuth";
import { getEntityActivityTimeline } from "@/lib/activity";

const ENTITY_TYPES = ["CLIENT", "STAFF", "TASK", "LEAD", "DOCUMENT", "INVOICE", "QUOTATION", "RECONCILIATION", "FIRM"] as const;

const querySchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

/** Read-only pagination endpoint backing <ActivityTimeline /> — see src/lib/activity.ts for the ownership check this delegates to. */
export async function GET(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    entityType: searchParams.get("entityType"),
    entityId: searchParams.get("entityId"),
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await getEntityActivityTimeline({
    firmId: auth.session.firmId, // from the session, never from the query string
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
  });

  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ activities: result.activities, nextCursor: result.nextCursor });
}
