import type { ComplianceRule, Client, ClientGstin } from "@prisma/client";
import { parseFixedAnnual } from "@/lib/recurrence";

// Structured applicability conditions stored in ComplianceRule.conditions —
// a plain JSON shape interpreted here rather than a full expression language,
// since the rule set is small and hand-curated (see scripts/seed-compliance-rules.mjs).
type RuleConditions = {
  entityTypes?: string[];
  requiresGstin?: boolean;
  qrmpOnly?: boolean;
  nonQrmpOnly?: boolean;
};

type ClientForRules = Pick<Client, "type" | "gstin">;
type GstinForRules = Pick<ClientGstin, "gstin" | "qrmpOpted" | "active">;

export function isRuleApplicable(rule: ComplianceRule, client: ClientForRules, clientGstin?: GstinForRules): boolean {
  const cond = (rule.conditions ?? {}) as RuleConditions;
  if (cond.entityTypes && !cond.entityTypes.includes(client.type)) return false;
  if (cond.requiresGstin && !client.gstin && !clientGstin) return false;
  if (rule.appliesToGstin) {
    if (!clientGstin) return false; // per-GSTIN rule with no GSTIN row to evaluate against
    if (cond.qrmpOnly && !clientGstin.qrmpOpted) return false;
    if (cond.nonQrmpOnly && clientGstin.qrmpOpted) return false;
  }
  return true;
}

/** Every (rule, GSTIN) pair a client is currently subject to — one entry per active ClientGstin for GSTIN-scoped rules, one entry total for the rest. */
export function getApplicableRuleInstances<G extends GstinForRules>(
  rules: ComplianceRule[],
  client: ClientForRules,
  clientGstins: G[]
): { rule: ComplianceRule; clientGstin?: G }[] {
  const instances: { rule: ComplianceRule; clientGstin?: G }[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.appliesToGstin) {
      for (const gstin of clientGstins) {
        if (!gstin.active) continue;
        if (isRuleApplicable(rule, client, gstin)) instances.push({ rule, clientGstin: gstin });
      }
    } else if (isRuleApplicable(rule, client)) {
      instances.push({ rule });
    }
  }
  return instances;
}

/**
 * Precise due date computed from the period key itself, not an offset from
 * "whenever the cron happened to run" — statutory deadlines need to land on
 * the actual government-mandated date. `basePeriodKey` is the plain period
 * (e.g. "2026-07", "2026-Q2", "2026"), without any GSTIN suffix.
 */
export function resolveRuleDueDate(rule: ComplianceRule, basePeriodKey: string): Date {
  if (rule.overrideDueDate && rule.overrideAppliesToPeriod === basePeriodKey) {
    return rule.overrideDueDate;
  }

  const fixed = parseFixedAnnual(rule.recurrence);
  if (fixed) {
    const year = parseInt(basePeriodKey, 10);
    return new Date(year, fixed.month - 1, fixed.day);
  }

  const offsetDay = rule.dueDateOffsetDays ?? 20;

  const monthly = basePeriodKey.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    const year = parseInt(monthly[1], 10);
    const month = parseInt(monthly[2], 10); // 1-indexed period month
    let dueYear = year;
    let dueMonth = month + 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
    return new Date(dueYear, dueMonth - 1, offsetDay);
  }

  const quarterly = basePeriodKey.match(/^(\d{4})-Q(\d)$/);
  if (quarterly) {
    const year = parseInt(quarterly[1], 10);
    const quarter = parseInt(quarterly[2], 10); // 1..4, calendar quarters — GST return quarters align with these
    let dueYear = year;
    let dueMonth = quarter * 3 + 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
    return new Date(dueYear, dueMonth - 1, offsetDay);
  }

  // Plain ANNUAL without a fixed MM-DD shouldn't occur in the seeded rule set, but guard anyway.
  const year = parseInt(basePeriodKey, 10) || new Date().getFullYear();
  return new Date(year, 11, 31);
}
