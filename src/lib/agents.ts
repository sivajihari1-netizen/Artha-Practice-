import { recordAgentAction, AgentAction, AgentTier } from "@/lib/agentActions";
import {
  get_client_task_status,
  get_client_history,
  get_document_checklist,
  draft_whatsapp_reply,
  flag_for_staff_review,
} from "@/lib/agentTools";
import { claudeConfigured, runClaudeAgent } from "@/lib/claudeAgent";

type AgentDecision = { proposedAction: string; inputContext: Record<string, unknown> } | null;

/**
 * Generic tier-branching engine, shared by every agent. Records whatever
 * `decide` comes back with — Tier 1 = auto-execute (routine, reversible,
 * nothing submitted externally), Tier 2/3 always park for a human (see the
 * spec's tier definitions). Returning null from `decide` means the agent
 * looked and genuinely found nothing to do — those don't get recorded at
 * all, so the review queue isn't cluttered with no-ops.
 */
async function runAgent(params: {
  agentType: string;
  tier: AgentTier;
  firmId: string;
  clientId: string;
  decide: () => Promise<AgentDecision>;
}): Promise<AgentAction | null> {
  const decision = await params.decide();
  if (decision === null) return null;

  const status = params.tier === 1 ? "executed" : "pending_review";

  return recordAgentAction({
    firmId: params.firmId,
    agentType: params.agentType,
    tier: params.tier,
    clientId: params.clientId,
    inputContext: decision.inputContext,
    proposedAction: decision.proposedAction,
    status,
  });
}

/** Tier 1 — replaces fixed T-7/T-3/T-1 cron logic with judgment based on client history. */
export function documentChaseAgent(params: { firmId: string; clientId: string; taskId: string; dueDate: string }) {
  return runAgent({
    agentType: "document_chase",
    tier: 1,
    firmId: params.firmId,
    clientId: params.clientId,
    decide: async () => {
      const checklist = await get_document_checklist(params.clientId);
      const pending = checklist.filter((c) => !c.fulfilled);
      if (pending.length === 0) return null; // nothing outstanding — no reminder needed, not worth recording

      const daysRemaining = Math.ceil((new Date(params.dueDate).getTime() - Date.now()) / 86400000);

      if (!claudeConfigured) {
        return mockDocumentChaseDecide({ clientId: params.clientId, pending, daysRemaining, dueDate: params.dueDate });
      }

      const history = await get_client_history(params.clientId);

      const result = await runClaudeAgent({
        system:
          "You help a CA (Chartered Accountant) firm's document-chase agent decide whether to nudge a client about pending documents ahead of a filing deadline. A client who is historically prompt (low avgDaysLate, no missed deadlines) shouldn't be nagged days early — wait unless the deadline is close. A client who often runs late should be reminded now, with an urgent tone if very few days remain. If a reminder is warranted, call draft_whatsapp_reply with category \"reminder\" and a one-sentence context naming the pending items and due date. If it's better to wait, don't call any tool — just say why in one sentence.",
        userMessage: `Client ${params.clientId}, task ${params.taskId}. Due date: ${params.dueDate} (${daysRemaining} days remaining). Pending documents: ${pending.map((p) => p.label).join(", ")}. Client history: ${JSON.stringify(history)}.`,
        tools: [
          {
            name: "draft_whatsapp_reply",
            description: "Send a WhatsApp reminder to the client about pending documents. Only call this if a reminder should be sent now, not if it's better to wait.",
            input_schema: {
              type: "object",
              properties: {
                context: { type: "string", description: "One-sentence summary of what's pending and the due date" },
              },
              required: ["context"],
            },
            handler: (input: { context: string }) => draft_whatsapp_reply(params.clientId, "reminder", input.context),
          },
        ],
        actionToolName: "draft_whatsapp_reply",
      });

      if (!result.actionTaken) {
        return {
          proposedAction: `Decided to wait — client history suggests a reminder isn't needed yet (${daysRemaining} days remaining).`,
          inputContext: { history, checklist, daysRemaining },
        };
      }

      const sendResult = result.toolResult as { sent: boolean; preview: string; reason?: string };
      return {
        proposedAction: sendResult.sent ? `Sent reminder: "${sendResult.preview}"` : `Attempted reminder but couldn't send: ${sendResult.reason}`,
        inputContext: { history, checklist, daysRemaining, ...result.toolInput },
      };
    },
  });
}

/** Tier 2 — always goes to review; reconciling a filing against portal status carries real compliance weight. */
export function reconciliationAgent(params: { firmId: string; clientId: string; taskId: string; acknowledgmentNumber: string | null }) {
  return runAgent({
    agentType: "reconciliation",
    tier: 2,
    firmId: params.firmId,
    clientId: params.clientId,
    decide: async () => {
      const portalStatus = mockPortalStatusCheck(params.acknowledgmentNumber);
      const taskStatus = await get_client_task_status(params.clientId);

      if (portalStatus === "MATCHED") return null; // clear match — no action needed

      if (!claudeConfigured) {
        return mockReconciliationDecide({ portalStatus, taskStatus });
      }

      const result = await runClaudeAgent({
        system:
          "You help a CA firm's GST/portal reconciliation agent flag a task for staff review. The task was marked completed by staff, but a check against the government portal found a discrepancy. Always call flag_for_staff_review — never let this pass silently, this carries compliance risk. If portalStatus is MISMATCH (portal shows the filing as not actually filed despite being marked done), the reason and suggested_action must be marked CRITICAL and escalate to the partner immediately, since the client may be told a filing is done when it isn't. If portalStatus is AMBIGUOUS (the portal response couldn't be cleanly matched, e.g. a partial or format-mismatched response), ask staff to manually verify rather than escalating as critical.",
        userMessage: `Client ${params.clientId}, task ${params.taskId}. Portal status check result: ${portalStatus}. Current task status: ${JSON.stringify(taskStatus)}.`,
        tools: [
          {
            name: "flag_for_staff_review",
            description: "Flag this reconciliation discrepancy for staff/partner review.",
            input_schema: {
              type: "object",
              properties: {
                reason: { type: "string", description: "What was found and why it needs review" },
                suggested_action: { type: "string", description: "What staff should do next" },
              },
              required: ["reason", "suggested_action"],
            },
            handler: (input: { reason: string; suggested_action: string }) =>
              flag_for_staff_review(params.clientId, input.reason, input.suggested_action),
          },
        ],
        actionToolName: "flag_for_staff_review",
      });

      if (!result.actionTaken) {
        // The model should always call the tool here (portalStatus is never MATCHED at this
        // point) — treat a no-call as a fallback flag rather than silently dropping it.
        return mockReconciliationDecide({ portalStatus, taskStatus });
      }

      const flag = result.toolResult as { reason: string; suggested_action: string };
      const prefix = portalStatus === "MISMATCH" ? "CRITICAL: " : "";
      return {
        proposedAction: `${prefix}${flag.suggested_action}`,
        inputContext: { portalStatus, taskStatus, flag },
      };
    },
  });
}

/** Deterministic fallback for documentChaseAgent when ANTHROPIC_API_KEY isn't configured — same stub-mode pattern as sendEmail/sendWhatsAppMessage. */
function mockDocumentChaseDecide(params: {
  clientId: string;
  pending: { label: string; fulfilled: boolean }[];
  daysRemaining: number;
  dueDate: string;
}): AgentDecision {
  const tone = params.daysRemaining <= 1 ? "urgent" : "routine";
  const context = `${params.pending.map((p) => p.label).join(", ")} still pending, due ${params.dueDate}.`;
  return {
    proposedAction: `[stub — no ANTHROPIC_API_KEY] Would send ${tone} reminder: "Reminder: ${context}"`,
    inputContext: { pending: params.pending, daysRemaining: params.daysRemaining, tone },
  };
}

/** Deterministic fallback for reconciliationAgent when ANTHROPIC_API_KEY isn't configured. */
function mockReconciliationDecide(params: {
  portalStatus: "AMBIGUOUS" | "MISMATCH";
  taskStatus: Awaited<ReturnType<typeof get_client_task_status>>;
}): AgentDecision {
  if (params.portalStatus === "MISMATCH") {
    return {
      proposedAction: "CRITICAL: [stub — no ANTHROPIC_API_KEY] Escalate to partner immediately — verify filing status before the client is told it's done.",
      inputContext: { portalStatus: params.portalStatus, taskStatus: params.taskStatus },
    };
  }
  return {
    proposedAction: "[stub — no ANTHROPIC_API_KEY] Manually verify the ARN against the portal before closing this out.",
    inputContext: { portalStatus: params.portalStatus, taskStatus: params.taskStatus },
  };
}

/** Stand-in for a real GSP/ERI portal status query — no such integration exists yet. */
function mockPortalStatusCheck(acknowledgmentNumber: string | null): "MATCHED" | "AMBIGUOUS" | "MISMATCH" {
  if (!acknowledgmentNumber) return "MISMATCH";
  const hash = [...acknowledgmentNumber].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (hash % 5 === 0) return "MISMATCH";
  if (hash % 3 === 0) return "AMBIGUOUS";
  return "MATCHED";
}
