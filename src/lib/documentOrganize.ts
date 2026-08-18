export const WORK_TYPES = ["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  GST: "GST",
  TDS: "TDS",
  ITR: "Income Tax (ITR)",
  ROC: "ROC / MCA",
  AUDIT: "Audit",
  OTHER: "Other",
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const UNCATEGORIZED = "uncategorized";

type OrganizableDoc = { workType: string | null; periodYear: number | null; periodMonth: number | null };

/** Groups documents into Year > Work Type > Month buckets. Missing values fall into an "Uncategorized"/"Undated" bucket. */
export function groupDocuments<T extends OrganizableDoc>(docs: T[]) {
  const byYear = new Map<string, T[]>();
  for (const doc of docs) {
    const yearKey = doc.periodYear ? String(doc.periodYear) : UNCATEGORIZED;
    if (!byYear.has(yearKey)) byYear.set(yearKey, []);
    byYear.get(yearKey)!.push(doc);
  }
  return byYear;
}

export function yearLabel(key: string): string {
  return key === UNCATEGORIZED ? "Undated" : key;
}

export function workTypeLabel(key: string): string {
  return key === UNCATEGORIZED ? "Uncategorized" : WORK_TYPE_LABELS[key as WorkType] ?? key;
}

export function monthLabel(key: string): string {
  return key === UNCATEGORIZED ? "No Month" : MONTH_NAMES[Number(key) - 1] ?? key;
}
