// Seeds the global ComplianceRule table that drives auto-detection of
// applicable statutory filings (see src/lib/complianceRules.ts). Idempotent —
// safe to re-run, upserts on the unique ruleCode.
//
// IMPORTANT: these are common-case defaults derived from general statutory
// patterns, NOT verified against this year's specific CBDT/MCA/CBIC circulars
// or extensions. Review due dates before relying on them, and use
// overrideDueDate/overrideAppliesToPeriod on a rule when the government
// extends a deadline — that cascades to every client's next generated task
// for that period without editing rows by hand.
//
// Deliberately excluded:
// - TDS filings: no reliable signal on Client to auto-detect TDS applicability
//   without a real false-positive risk (not every business deducts TDS).
// - ROC AOC-4 / MGT-7 (company annual filings): NOT seeded here because every
//   firm already gets these as per-firm TaskTemplates at signup (see
//   src/lib/mcaTemplates.ts / scripts/backfill-mca-templates.mjs) — seeding
//   them again here would generate a duplicate task per company client.
import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

const RULES = [
  {
    ruleCode: "GSTR1_MONTHLY",
    title: "GSTR-1 (Monthly)",
    description: "Monthly return for outward supplies — non-QRMP GSTINs.",
    returnType: "GST",
    recurrence: "MONTHLY",
    appliesToGstin: true,
    conditions: { requiresGstin: true, nonQrmpOnly: true },
    dueDateOffsetDays: 11,
  },
  {
    ruleCode: "GSTR1_QRMP",
    title: "GSTR-1 (QRMP)",
    description: "Quarterly return for outward supplies — QRMP-opted GSTINs.",
    returnType: "GST",
    recurrence: "QUARTERLY",
    appliesToGstin: true,
    conditions: { requiresGstin: true, qrmpOnly: true },
    dueDateOffsetDays: 13,
  },
  {
    ruleCode: "GSTR3B_MONTHLY",
    title: "GSTR-3B (Monthly)",
    description: "Monthly summary return and tax payment — non-QRMP GSTINs.",
    returnType: "GST",
    recurrence: "MONTHLY",
    appliesToGstin: true,
    conditions: { requiresGstin: true, nonQrmpOnly: true },
    dueDateOffsetDays: 20,
  },
  {
    ruleCode: "GSTR3B_QRMP",
    title: "GSTR-3B (QRMP)",
    description: "Quarterly summary return — QRMP-opted GSTINs. Actual due date is 22nd or 24th depending on state category; defaulted to 22nd, adjust per-task if needed.",
    returnType: "GST",
    recurrence: "QUARTERLY",
    appliesToGstin: true,
    conditions: { requiresGstin: true, qrmpOnly: true },
    dueDateOffsetDays: 22,
  },
  {
    ruleCode: "ITR_ITR3",
    title: "ITR-3 / ITR-4 (Individual / Proprietorship)",
    description: "Annual income tax return for individuals and proprietorships.",
    returnType: "ITR",
    recurrence: "ANNUAL:07-31",
    appliesToGstin: false,
    conditions: { entityTypes: ["INDIVIDUAL", "PROPRIETORSHIP"] },
  },
  {
    ruleCode: "ITR_ITR5",
    title: "ITR-5 (Partnership / LLP)",
    description: "Annual income tax return for partnerships and LLPs.",
    returnType: "ITR",
    recurrence: "ANNUAL:07-31",
    appliesToGstin: false,
    conditions: { entityTypes: ["PARTNERSHIP", "LLP"] },
  },
  {
    ruleCode: "ITR_ITR6",
    title: "ITR-6 (Company)",
    description: "Annual income tax return for companies (non-Sec 11 entities).",
    returnType: "ITR",
    recurrence: "ANNUAL:10-31",
    appliesToGstin: false,
    conditions: { entityTypes: ["COMPANY"] },
  },
  {
    ruleCode: "LLP_FORM8",
    title: "LLP Form 8 — Statement of Account & Solvency",
    description: "Annual LLP filing under the LLP Act.",
    returnType: "ROC",
    recurrence: "ANNUAL:10-30",
    appliesToGstin: false,
    conditions: { entityTypes: ["LLP"] },
  },
  {
    ruleCode: "LLP_FORM11",
    title: "LLP Form 11 — Annual Return",
    description: "Annual LLP return under the LLP Act.",
    returnType: "ROC",
    recurrence: "ANNUAL:05-30",
    appliesToGstin: false,
    conditions: { entityTypes: ["LLP"] },
  },
];

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

async function main() {
  for (const rule of RULES) {
    await prisma.complianceRule.upsert({
      where: { ruleCode: rule.ruleCode },
      update: rule,
      create: rule,
    });
    console.log(`Upserted ${rule.ruleCode}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
