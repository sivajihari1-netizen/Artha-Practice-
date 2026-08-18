// One-off: adds the 4 standard MCA task templates to any firm that signed up
// before this feature existed. New firms get these automatically at signup
// (see src/lib/mcaTemplates.ts). Safe to re-run — skips firms that already
// have a template with the same title.
import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

const MCA_DEADLINE_TEMPLATES = [
  { title: "AOC-4 — Annual Financial Statements", returnType: "ROC", recurrence: "ANNUAL:10-30" },
  { title: "MGT-7 / MGT-7A — Annual Return", returnType: "ROC", recurrence: "ANNUAL:11-29" },
  { title: "DIR-3 KYC — Director KYC", returnType: "ROC", recurrence: "ANNUAL:09-30" },
  { title: "DPT-3 — Return of Deposits", returnType: "ROC", recurrence: "ANNUAL:06-30" },
];

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

async function main() {
  const firms = await prisma.firm.findMany({ select: { id: true, name: true } });
  for (const firm of firms) {
    const existing = await prisma.taskTemplate.findMany({
      where: { firmId: firm.id, title: { in: MCA_DEADLINE_TEMPLATES.map((t) => t.title) } },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((t) => t.title));
    const toCreate = MCA_DEADLINE_TEMPLATES.filter((t) => !existingTitles.has(t.title));
    if (toCreate.length === 0) {
      console.log(`${firm.name}: already has all MCA templates, skipping.`);
      continue;
    }
    await prisma.taskTemplate.createMany({ data: toCreate.map((t) => ({ ...t, firmId: firm.id })) });
    console.log(`${firm.name}: added ${toCreate.length} MCA template(s).`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
