// One-off: copies each existing Client's single `gstin` field into a matching
// ClientGstin row, so every client uniformly has their GST registration
// represented in the new multi-GSTIN table. Client.gstin itself is left
// untouched (still used by invoice GST-type logic). Safe to re-run — skips
// clients that already have a ClientGstin for that GSTIN.
//
// Deliberately does NOT trigger compliance-rule task generation — per
// product decision, the rule engine only applies to clients created/edited
// from here on, not retroactively to existing real firms' clients.
import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

// First 2 digits of a GSTIN → state, per GST registration numbering.
const STATE_CODES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  "97": "Other Territory",
};

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

async function main() {
  const clients = await prisma.client.findMany({ where: { gstin: { not: null } }, select: { id: true, name: true, gstin: true } });
  let created = 0;
  let skipped = 0;

  for (const client of clients) {
    const gstin = client.gstin.trim().toUpperCase();
    const existing = await prisma.clientGstin.findFirst({ where: { clientId: client.id, gstin } });
    if (existing) { skipped++; continue; }

    const state = STATE_CODES[gstin.slice(0, 2)] ?? "Unknown";
    await prisma.clientGstin.create({ data: { clientId: client.id, gstin, state, qrmpOpted: false } });
    created++;
    console.log(`${client.name}: backfilled GSTIN ${gstin} (${state})`);
  }

  console.log(`Done. Created ${created}, skipped ${skipped} (already present).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
