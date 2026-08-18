import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirrors the draft pricing on the marketing site (artha-website.html) —
// update figures there and here together if you change them.
const PLANS = [
  { name: "Solo", priceAnnualInr: 1000, maxUsers: 1, storageGb: 2 },
  { name: "Starter", priceAnnualInr: 7500, maxUsers: 10, storageGb: 5 },
  { name: "Growth", priceAnnualInr: 12500, maxUsers: 20, storageGb: 5 },
  { name: "Scale", priceAnnualInr: 17000, maxUsers: 40, storageGb: 10 },
  { name: "Enterprise", priceAnnualInr: 27000, maxUsers: 60, storageGb: 20 },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log(`Seeded ${PLANS.length} plans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
