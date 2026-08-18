// Standard MCA (Ministry of Corporate Affairs) statutory deadlines, seeded
// for every new firm so compliance tracking covers ROC filings out of the
// box, not just GST/TDS/ITR. Due dates are fixed calendar dates every year
// (see "ANNUAL:MM-DD" handling in recurringTasks.ts), not offsets from a
// company's own AGM date — firms can edit individual generated tasks if
// their AGM timing shifts AOC-4/MGT-7 due dates.
export const MCA_DEADLINE_TEMPLATES = [
  { title: "AOC-4 — Annual Financial Statements", returnType: "ROC" as const, recurrence: "ANNUAL:10-30" },
  { title: "MGT-7 / MGT-7A — Annual Return", returnType: "ROC" as const, recurrence: "ANNUAL:11-29" },
  { title: "DIR-3 KYC — Director KYC", returnType: "ROC" as const, recurrence: "ANNUAL:09-30" },
  { title: "DPT-3 — Return of Deposits", returnType: "ROC" as const, recurrence: "ANNUAL:06-30" },
];
