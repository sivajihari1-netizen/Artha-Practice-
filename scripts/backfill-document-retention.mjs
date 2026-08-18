// One-off: backfills retentionExpiryDate and sourceChannel on Document rows
// created before this tracking existed. retentionExpiryDate = uploadedAt + 8
// years (a single sane default, see prisma/schema.prisma comment on
// Document.retentionExpiryDate — no yearly archival job consumes this yet,
// it's just made ready). sourceChannel is set to WHATSAPP_LINK for rows
// whose category literally matches the hardcoded value the token-upload
// route has always used; everything else defaults to STAFF_MANUAL_UPLOAD
// (the schema default), which is the closest honest guess for historical
// rows that predate real per-upload channel tracking. Safe to re-run —
// only touches rows where retentionExpiryDate is still null.
import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

const WHATSAPP_UPLOAD_CATEGORY = "Client Upload (WhatsApp request)";

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

async function main() {
  const documents = await prisma.document.findMany({
    where: { retentionExpiryDate: null },
    select: { id: true, uploadedAt: true, category: true },
  });

  for (const doc of documents) {
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        retentionExpiryDate: addYears(doc.uploadedAt, 8),
        ...(doc.category === WHATSAPP_UPLOAD_CATEGORY ? { sourceChannel: "WHATSAPP_LINK" } : {}),
      },
    });
  }

  console.log(`Backfilled ${documents.length} document(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
