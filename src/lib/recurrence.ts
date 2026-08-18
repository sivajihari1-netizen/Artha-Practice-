// Shared recurrence/period-key math used by both the manual TaskTemplate
// generator (recurringTasks.ts) and the ComplianceRule engine
// (complianceRules.ts) — kept in its own module so neither of those two
// files has to import from the other.

/**
 * Fixed statutory deadlines (e.g. MCA forms like DIR-3 KYC, due every Sep 30
 * regardless of when the task happens to be generated) use "ANNUAL:MM-DD"
 * instead of the plain recurrence keywords. Parsed here rather than adding a
 * new column, since TaskTemplate.recurrence was already a free-text string.
 */
export function parseFixedAnnual(recurrence: string): { month: number; day: number } | null {
  const m = recurrence.trim().match(/^ANNUAL:(\d{2})-(\d{2})$/i);
  if (!m) return null;
  return { month: parseInt(m[1], 10), day: parseInt(m[2], 10) };
}

/** The next occurrence of a fixed MM-DD date — this year if not yet passed, else next year. */
export function nextFixedDate(month: number, day: number, now: Date): Date {
  const candidate = new Date(now.getFullYear(), month - 1, day);
  return candidate.getTime() < now.getTime() ? new Date(now.getFullYear() + 1, month - 1, day) : candidate;
}

/**
 * Computes the current "period key" for a recurrence pattern, used to dedupe
 * generated tasks (one per client per template/rule per period).
 */
export function currentPeriodKey(recurrence: string, now: Date): string {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const fixed = parseFixedAnnual(recurrence);
  if (fixed) {
    return String(nextFixedDate(fixed.month, fixed.day, now).getFullYear());
  }

  switch (recurrence.toUpperCase()) {
    case "MONTHLY":
      return `${year}-${String(month + 1).padStart(2, "0")}`;
    case "QUARTERLY": {
      const quarter = Math.floor(month / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case "ANNUAL":
      return `${year}`;
    case "WEEKLY": {
      const start = new Date(year, 0, 1);
      const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
      const week = Math.floor(days / 7);
      return `${year}-W${week}`;
    }
    default:
      return `${year}-${String(month + 1).padStart(2, "0")}`;
  }
}
