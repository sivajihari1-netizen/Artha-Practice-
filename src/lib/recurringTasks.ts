import { prisma } from "@/lib/prisma";
import { Prisma, Role, TaskStatus, type Client, type ClientGstin } from "@prisma/client";
import { currentPeriodKey, parseFixedAnnual, nextFixedDate } from "@/lib/recurrence";
import { getApplicableRuleInstances, resolveRuleDueDate } from "@/lib/complianceRules";
import { ActivityEvent, recordActivity } from "@/lib/activity";

/** Rough default due date offset per recurrence — firms can edit per-task afterward. */
function defaultDueDate(recurrence: string, now: Date): Date {
  const fixed = parseFixedAnnual(recurrence);
  if (fixed) return nextFixedDate(fixed.month, fixed.day, now);

  const due = new Date(now);
  switch (recurrence.toUpperCase()) {
    case "MONTHLY":
      due.setDate(due.getDate() + 20);
      break;
    case "QUARTERLY":
      due.setDate(due.getDate() + 45);
      break;
    case "ANNUAL":
      due.setDate(due.getDate() + 90);
      break;
    default:
      due.setDate(due.getDate() + 7);
  }
  return due;
}

/**
 * Whether a client is a plausible candidate for a template's return type.
 * Without this, a GST template fires for clients with no GSTIN and an
 * MCA/ROC template fires for individuals who were never registered with the
 * Registrar of Companies — cluttering the board with tasks nobody will ever
 * complete. TDS/ITR/AUDIT/OTHER stay unfiltered since eligibility there
 * depends on things we don't track (turnover, employees, deduction
 * liability) — better to occasionally over-generate than silently skip
 * something a firm actually needed.
 */
function isClientEligibleForTemplate(client: { type: string; gstin: string | null }, returnType: string): boolean {
  if (returnType === "GST") return !!client.gstin;
  if (returnType === "ROC") return client.type === "COMPANY" || client.type === "LLP";
  return true;
}

/**
 * Generates recurring tasks for every eligible active client of a firm, for
 * every active TaskTemplate belonging to that firm, for the current period.
 * Safe to call repeatedly (e.g. from a daily cron) — the
 * (sourceTemplateId, clientId, periodKey) unique constraint on Task is still
 * the final safety net (see `createMany({ skipDuplicates: true })` below),
 * but it is no longer the *primary* daily skip mechanism.
 *
 * PERFORMANCE (production incident fix — see the forensic investigation and
 * fix-design conversation this replaces): the previous version issued one
 * sequential `prisma.task.create()` per (template, client) pair and relied on
 * catching the P2002 unique-constraint error to detect "already generated."
 * At real production scale (13 firms, ~4 templates/firm) this reproducibly
 * took ~30 seconds end-to-end, and — critically — an idempotent no-op day
 * cost exactly as much as a cold run, since every combination still had to
 * be individually attempted. This version instead: (1) builds the full
 * candidate list in memory (no DB calls), (2) does ONE bulk read of which
 * (sourceTemplateId, clientId, periodKey) combinations already exist for
 * this firm's templates, (3) filters candidates against that set in memory,
 * (4) writes only the genuinely-new rows in a single `createMany` call. A
 * warm/no-op day now costs one bulk read instead of N attempted writes.
 *
 * Wire this up to a scheduler in production, e.g. a Vercel Cron Job hitting
 * POST /api/cron/generate-recurring-tasks once a day.
 */
export async function generateRecurringTasksForFirm(firmId: string, now: Date = new Date()) {
  const [templates, clients] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { firmId, active: true } }),
    prisma.client.findMany({ where: { firmId, active: true } }),
  ]);

  type Candidate = {
    sourceTemplateId: string;
    clientId: string;
    periodKey: string;
    title: string;
    returnType: (typeof templates)[number]["returnType"];
    dueDate: Date;
    checklist: Prisma.InputJsonValue | undefined;
  };
  const candidates: Candidate[] = [];
  for (const template of templates) {
    const periodKey = currentPeriodKey(template.recurrence, now);
    for (const client of clients) {
      if (!isClientEligibleForTemplate(client, template.returnType)) continue;
      candidates.push({
        sourceTemplateId: template.id,
        clientId: client.id,
        periodKey,
        title: `${template.title} — ${client.name}`,
        returnType: template.returnType,
        dueDate: defaultDueDate(template.recurrence, now),
        checklist: (template.checklist as Prisma.InputJsonValue | null) ?? undefined,
      });
    }
  }
  if (candidates.length === 0) return { created: 0, skipped: 0 };

  // Bulk pre-check — one read instead of one attempted write per candidate.
  // Bounded to just this firm's templates, so the result set stays small
  // regardless of how much history the firm has accumulated.
  const templateIds = [...new Set(candidates.map((c) => c.sourceTemplateId))];
  const existing = await prisma.task.findMany({
    where: { firmId, sourceTemplateId: { in: templateIds } },
    select: { sourceTemplateId: true, clientId: true, periodKey: true },
  });
  const existingKeys = new Set(existing.map((t) => `${t.sourceTemplateId}:${t.clientId}:${t.periodKey}`));

  const toCreate = candidates.filter((c) => !existingKeys.has(`${c.sourceTemplateId}:${c.clientId}:${c.periodKey}`));
  if (toCreate.length === 0) return { created: 0, skipped: candidates.length };

  // skipDuplicates keeps the unique constraint as the true final safety net
  // (e.g. a concurrent run slipping a row in between the read above and this
  // write) — a race here is silently skipped, not thrown, same intent as the
  // old per-row P2002 catch but without needing a catch at all.
  //
  // createManyAndReturn (not createMany) so the P0.6 activity step below can
  // see exactly which rows were genuinely inserted — skipDuplicates means
  // its result excludes anything the unique constraint silently skipped, so
  // a retry or a candidate the pre-check missed can never produce a
  // TASK_CREATED activity for a task that wasn't actually (newly) created.
  // Same single round-trip as createMany; only the return shape differs.
  const created = await prisma.task.createManyAndReturn({
    data: toCreate.map((c) => ({
      firmId,
      clientId: c.clientId,
      title: c.title,
      returnType: c.returnType,
      dueDate: c.dueDate,
      checklist: c.checklist,
      sourceTemplateId: c.sourceTemplateId,
      periodKey: c.periodKey,
    })),
    skipDuplicates: true,
    select: { id: true, clientId: true, sourceTemplateId: true, periodKey: true, title: true },
  });

  await Promise.all(
    created.map((task) =>
      recordActivity({
        firmId,
        entityType: "TASK",
        entityId: task.id,
        eventType: ActivityEvent.TASK_CREATED,
        title: `Task created: ${task.title}`,
        actorType: "SYSTEM",
        metadata: { taskId: task.id, clientId: task.clientId, sourceTemplateId: task.sourceTemplateId, periodKey: task.periodKey },
      })
    )
  );

  return { created: created.length, skipped: candidates.length - created.length };
}

/**
 * The STAFF/MANAGER in a firm with the fewest currently-open (not DONE)
 * assigned tasks, for each firm's staff roster — fetched once per firm and
 * cached in-memory by the caller, since newly-created tasks in the same batch
 * aren't reflected in these DB counts yet.
 */
// Exported so the Staff workload view can reuse this exact query (P1 batch,
// staff workload visibility) — the function itself is untouched, only its
// visibility changed, so the recurring-task load balancer's own behavior is
// unaffected.
export async function getStaffLoadForFirm(firmId: string): Promise<{ userId: string; load: number }[]> {
  const staff = await prisma.user.findMany({
    where: { firmId, active: true, role: { in: [Role.STAFF, Role.MANAGER] } },
    select: {
      id: true,
      _count: { select: { assignedTasks: { where: { status: { not: TaskStatus.DONE } } } } },
    },
  });
  return staff.map((s) => ({ userId: s.id, load: s._count.assignedTasks }));
}

/**
 * Generates ComplianceRule-driven tasks for a set of clients (each with its
 * `gstins` relation loaded). Unlike generateRecurringTasksForFirm above, this
 * only creates a task once its due date falls within `lookaheadDays` — a
 * firm's task list shouldn't fill up with filings 11 months out. Same
 * bulk-pre-check + createMany pattern as above, keyed on
 * (complianceRuleId, clientId, periodKey).
 *
 * Signature is unchanged from before this fix — this is called both from the
 * daily cron (many clients, one firm) and from the client create/update/GSTIN
 * routes (a single client) — every existing call site keeps working
 * unmodified; only the internal write pattern changed. Assignee
 * load-balancing (pickAssignee) stays sequential and in-memory — it's
 * stateful and order-dependent (each pick affects the next), and after the
 * first per-firm staff-load fetch it makes no further DB calls, so it isn't
 * the part that was ever slow.
 */
export async function generateComplianceRuleTasks(
  clients: (Client & { gstins: ClientGstin[] })[],
  now: Date = new Date(),
  lookaheadDays = 30
) {
  if (clients.length === 0) return { created: 0, skipped: 0 };

  const rules = await prisma.complianceRule.findMany({ where: { active: true } });
  if (rules.length === 0) return { created: 0, skipped: 0 };

  const loadByFirm = new Map<string, { userId: string; load: number }[]>();
  async function pickAssignee(firmId: string): Promise<string | null> {
    let staff = loadByFirm.get(firmId);
    if (!staff) {
      staff = await getStaffLoadForFirm(firmId);
      loadByFirm.set(firmId, staff);
    }
    if (staff.length === 0) return null;
    staff.sort((a, b) => a.load - b.load);
    staff[0].load++;
    return staff[0].userId;
  }

  const lookaheadMs = lookaheadDays * 24 * 60 * 60 * 1000;

  type Candidate = {
    firmId: string;
    clientId: string;
    ruleId: string;
    clientGstinId: string | undefined;
    periodKey: string;
    title: string;
    returnType: (typeof rules)[number]["returnType"];
    dueDate: Date;
  };
  const candidates: Candidate[] = [];
  for (const client of clients) {
    const instances = getApplicableRuleInstances(rules, client, client.gstins);
    for (const { rule, clientGstin } of instances) {
      const basePeriodKey = currentPeriodKey(rule.recurrence, now);
      const dueDate = resolveRuleDueDate(rule, basePeriodKey);
      if (dueDate.getTime() - now.getTime() > lookaheadMs) continue;

      const periodKey = clientGstin ? `${basePeriodKey}:${clientGstin.gstin}` : basePeriodKey;
      const title = clientGstin ? `${rule.title} — ${client.name} (${clientGstin.gstin})` : `${rule.title} — ${client.name}`;
      candidates.push({
        firmId: client.firmId,
        clientId: client.id,
        ruleId: rule.id,
        clientGstinId: clientGstin?.id,
        periodKey,
        title,
        returnType: rule.returnType,
        dueDate,
      });
    }
  }
  if (candidates.length === 0) return { created: 0, skipped: 0 };

  // Bulk pre-check, bounded to the rules and clients actually in play.
  const ruleIds = [...new Set(candidates.map((c) => c.ruleId))];
  const clientIds = [...new Set(candidates.map((c) => c.clientId))];
  const existing = await prisma.task.findMany({
    where: { complianceRuleId: { in: ruleIds }, clientId: { in: clientIds } },
    select: { complianceRuleId: true, clientId: true, periodKey: true },
  });
  const existingKeys = new Set(existing.map((t) => `${t.complianceRuleId}:${t.clientId}:${t.periodKey}`));

  const toCreate = candidates.filter((c) => !existingKeys.has(`${c.ruleId}:${c.clientId}:${c.periodKey}`));
  if (toCreate.length === 0) return { created: 0, skipped: candidates.length };

  // Assignee resolution stays sequential/in-memory (order-dependent load
  // balancing) — done here, after the pre-check, so we never spend a pick on
  // a candidate that turns out to already exist.
  const dataToInsert = [];
  for (const c of toCreate) {
    const assigneeId = await pickAssignee(c.firmId);
    dataToInsert.push({
      firmId: c.firmId,
      clientId: c.clientId,
      title: c.title,
      returnType: c.returnType,
      dueDate: c.dueDate,
      complianceRuleId: c.ruleId,
      clientGstinId: c.clientGstinId,
      assigneeId: assigneeId ?? undefined,
      periodKey: c.periodKey,
    });
  }

  // createManyAndReturn — see the comment in generateRecurringTasksForFirm
  // above; same reasoning applies here (P0.6), keyed on complianceRuleId
  // instead of sourceTemplateId.
  const created = await prisma.task.createManyAndReturn({
    data: dataToInsert,
    skipDuplicates: true,
    select: { id: true, firmId: true, clientId: true, complianceRuleId: true, periodKey: true, title: true },
  });

  await Promise.all(
    created.map((task) =>
      recordActivity({
        firmId: task.firmId,
        entityType: "TASK",
        entityId: task.id,
        eventType: ActivityEvent.TASK_CREATED,
        title: `Task created: ${task.title}`,
        actorType: "SYSTEM",
        metadata: { taskId: task.id, clientId: task.clientId, complianceRuleId: task.complianceRuleId, periodKey: task.periodKey },
      })
    )
  );

  return { created: created.length, skipped: candidates.length - created.length };
}
