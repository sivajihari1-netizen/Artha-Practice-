import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { documentChaseAgent, reconciliationAgent } from "@/lib/agents";

// Manual test-trigger endpoint — real usage will be a daily/weekly cron
// calling these agents directly (see the spec's Sections 3 and 5). This
// exists so the Tier 1 vs Tier 2 split and the review queue are exercisable
// through the running app rather than only via isolated function calls.
// Uses each firm's real clients/tasks — remove once a real cron trigger exists.
export async function POST() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const clients = await prisma.client.findMany({ where: { firmId: auth.session.firmId, active: true }, take: 3 });
  if (clients.length === 0) {
    return NextResponse.json({ error: "No clients in this firm to run the test agents against" }, { status: 400 });
  }

  const results: Record<string, unknown> = {};

  // Tier 1 — auto-executes, always recorded (or null if nothing to do).
  results.documentChaseAgent = await documentChaseAgent({
    firmId: auth.session.firmId,
    clientId: clients[0].id,
    taskId: "mock-task-1",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
  });

  // Tier 2 — three runs with different mock acknowledgment numbers to
  // deterministically exercise the MATCHED / AMBIGUOUS / MISMATCH branches
  // (mockPortalStatusCheck in src/lib/agents.ts — no real GSP/ERI integration exists yet).
  const client2 = clients[1] ?? clients[0];
  const client3 = clients[2] ?? clients[0];
  results.reconciliationAgent_matched = await reconciliationAgent({ firmId: auth.session.firmId, clientId: client2.id, taskId: "mock-task-2", acknowledgmentNumber: "ARN0001" });
  results.reconciliationAgent_ambiguous = await reconciliationAgent({ firmId: auth.session.firmId, clientId: client3.id, taskId: "mock-task-3", acknowledgmentNumber: "ARN0006" });
  results.reconciliationAgent_mismatch = await reconciliationAgent({ firmId: auth.session.firmId, clientId: clients[0].id, taskId: "mock-task-4", acknowledgmentNumber: "ARN0003" });

  return NextResponse.json({ results });
}
