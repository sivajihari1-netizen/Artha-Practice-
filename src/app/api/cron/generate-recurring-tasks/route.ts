import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRecurringTasksForFirm, generateComplianceRuleTasks } from "@/lib/recurringTasks";
import { mapWithConcurrency } from "@/lib/concurrency";

// Trigger this once a day from an external scheduler (Vercel Cron, a cron
// job on your VPS, GitHub Actions schedule, etc). Protect it with
// CRON_SECRET so randoms on the internet can't spam task creation.
//
// Example Vercel Cron config (vercel.json):
// { "crons": [{ "path": "/api/cron/generate-recurring-tasks", "schedule": "0 3 * * *" }] }
//
// Firms are processed with bounded concurrency (default 3, override via
// CRON_FIRM_CONCURRENCY) rather than fully sequential or fully parallel —
// see the production-incident fix this route was rewritten for: fully
// sequential processing at real production scale (13 firms) took ~30s
// end-to-end, close enough to typical platform/proxy request-timeout
// defaults to plausibly explain a cron crash with no further diagnostics
// available. Bounded concurrency overlaps firms' network-bound DB round
// trips without opening enough connections at once to risk exhausting the
// Prisma connection pool — 3 was chosen empirically (see the fix's
// benchmark) as comfortably fast without any sign of connection pressure.
const DEFAULT_FIRM_CONCURRENCY = 3;

function log(event: string, data: Record<string, unknown> = {}) {
  // Structured, one-line-per-event logging — deliberately firmId/counts
  // only, never firm/client names or anything from Firm/Client tables, so
  // this is safe to leave in a log aggregator indefinitely.
  console.log(JSON.stringify({ event, ...data, ts: new Date().toISOString() }));
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runStart = Date.now();
  log("RUN_STARTED");

  const firms = await prisma.firm.findMany({ select: { id: true } });
  log("FIRMS_DISCOVERED", { count: firms.length });

  const concurrency = Number(process.env.CRON_FIRM_CONCURRENCY) || DEFAULT_FIRM_CONCURRENCY;

  const results: Record<string, number> = {};
  const complianceResults: Record<string, number> = {};
  const errors: Record<string, string> = {};

  await mapWithConcurrency(firms, concurrency, async (firm) => {
    const firmStart = Date.now();
    try {
      const [{ created, skipped }, clients] = await Promise.all([
        generateRecurringTasksForFirm(firm.id),
        prisma.client.findMany({ where: { firmId: firm.id, active: true }, include: { gstins: true } }),
      ]);
      results[firm.id] = created;

      const { created: complianceCreated, skipped: complianceSkipped } = await generateComplianceRuleTasks(clients);
      complianceResults[firm.id] = complianceCreated;

      log("FIRM_COMPLETED", {
        firmId: firm.id,
        tasksCreated: created + complianceCreated,
        tasksSkipped: skipped + complianceSkipped,
        durationMs: Date.now() - firmStart,
      });
    } catch (err: any) {
      // Isolate failures per firm — one firm's error shouldn't block every other firm's run.
      const message = String(err?.message ?? err);
      errors[firm.id] = message;
      log("FIRM_FAILED", { firmId: firm.id, error: message, durationMs: Date.now() - firmStart });
    }
  });

  const firmsFailed = Object.keys(errors).length;
  const firmsSucceeded = firms.length - firmsFailed;
  const tasksCreated = Object.values(results).reduce((a, b) => a + b, 0) + Object.values(complianceResults).reduce((a, b) => a + b, 0);
  const summary = firmsFailed === 0 ? "SUCCESS" : firmsSucceeded === 0 ? "FAILURE" : "PARTIAL_FAILURE";
  const durationMs = Date.now() - runStart;

  log("RUN_COMPLETED", { firmsSucceeded, firmsFailed, tasksCreated, durationMs, summary });

  // HTTP status intentionally stays 200 regardless of per-firm business
  // failures — same contract as before this fix. curl -f (the Railway cron
  // trigger) uses the HTTP status to decide whether the *request* succeeded;
  // conflating that with "did every firm succeed" would make a single
  // firm's transient error look like an infrastructure crash, which is a
  // worse signal than what `summary` + the structured logs above already
  // give a human reading them. A real infra failure (timeout, unhandled
  // exception before this point) still surfaces as a non-200/no-response,
  // exactly as it did before.
  return NextResponse.json({ ok: true, summary, results, complianceResults, errors, durationMs });
}
