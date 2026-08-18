import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPendingAgentActions } from "@/lib/agentActions";
import { AgentActionButtons, RunTestAgentsButton } from "@/components/AgentActionButtons";

const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 — Auto-execute",
  2: "Tier 2 — Needs review",
  3: "Tier 3 — Never automatic",
};

export default async function AgentReviewPage() {
  const session = getSession();
  const canAct = session!.role !== "STAFF";

  const actions = await listPendingAgentActions(session!.firmId);
  const clientIds = [...new Set(actions.map((a) => a.clientId))];
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } });
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold">Agent Review Queue</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Tier 2/3 agent proposals waiting on a human decision. Tier 1 actions (routine, reversible) auto-execute and never
        appear here. Reasoning runs on Claude when ANTHROPIC_API_KEY is configured; otherwise agents fall back to a
        deterministic stub, same as the email/WhatsApp stub mode.
      </p>

      <div className="mb-6">
        <RunTestAgentsButton />
      </div>

      {actions.length === 0 ? (
        <div className="border border-line rounded-xl bg-white p-8 text-center text-sm text-gray-400">
          Nothing pending. Run the test agents above, or wait for a real trigger once one exists.
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <div key={a.id} className="border border-line rounded-xl bg-white p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{TIER_LABEL[a.tier]}</span>
                  <span className="text-xs text-gray-400">{a.agentType}</span>
                </div>
                <div className="font-medium text-sm">{a.proposedAction}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Client: {clientNameById.get(a.clientId) ?? a.clientId} · {new Date(a.createdAt).toLocaleString("en-IN")}
                </div>
              </div>
              {canAct && <AgentActionButtons id={a.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
