// Persisted store for agent-proposed actions (see prisma/schema.prisma —
// AgentAction). Backs the Tier 1/Tier 2/Tier 3 branching and human
// review-queue pattern in src/lib/agents.ts. Was originally an in-memory
// array for the mocked scaffold; moved to a real table once the agents
// started operating on real data, since a review queue that resets on every
// restart isn't an acceptable safety net for the Tier 2/3 "always park for a
// human" guarantee.

import { prisma } from "@/lib/prisma";
import type { AgentAction as PrismaAgentAction, Prisma } from "@prisma/client";

export type AgentTier = 1 | 2 | 3;
export type AgentActionStatus = "executed" | "pending_review" | "rejected";
export type AgentAction = PrismaAgentAction;

export function recordAgentAction(input: {
  firmId: string;
  agentType: string;
  tier: AgentTier;
  clientId: string;
  inputContext: Record<string, unknown>;
  proposedAction: string;
  status: AgentActionStatus;
}): Promise<AgentAction> {
  return prisma.agentAction.create({
    data: { ...input, inputContext: input.inputContext as Prisma.InputJsonValue },
  });
}

export function listPendingAgentActions(firmId: string): Promise<AgentAction[]> {
  return prisma.agentAction.findMany({
    where: { firmId, status: "pending_review" },
    orderBy: { createdAt: "desc" },
  });
}

export function getAgentAction(firmId: string, id: string): Promise<AgentAction | null> {
  return prisma.agentAction.findFirst({ where: { id, firmId } });
}

export async function resolveAgentAction(
  firmId: string,
  id: string,
  status: "executed" | "rejected",
  reviewedBy: string
): Promise<AgentAction | null> {
  const action = await getAgentAction(firmId, id);
  if (!action) return null;
  return prisma.agentAction.update({
    where: { id: action.id },
    data: { status, reviewedById: reviewedBy, reviewedAt: new Date() },
  });
}
