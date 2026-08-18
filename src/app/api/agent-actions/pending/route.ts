import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { listPendingAgentActions } from "@/lib/agentActions";

// The human review queue — every Tier 2/3 agent proposal waiting on a
// decision. Tier 1 actions never appear here since they auto-execute.
export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const actions = await listPendingAgentActions(auth.session.firmId);
  return NextResponse.json({ actions });
}
