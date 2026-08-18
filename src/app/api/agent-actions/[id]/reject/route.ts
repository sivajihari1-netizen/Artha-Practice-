import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { resolveAgentAction } from "@/lib/agentActions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can act on agent proposals" }, { status: 403 });
  }

  const action = await resolveAgentAction(auth.session.firmId, params.id, "rejected", auth.session.userId);
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ action });
}
