const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Truncating Conquest table...");
  // Using TRUNCATE restarts identity (if using sequences) and is much faster than deleteMany
  // For safety with raw queries in Prisma postgresql, we must use executeRaw
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Conquest" RESTART IDENTITY CASCADE');
  console.log("Table truncated successfully!");

  await prisma.$disconnect();
}

run().catch(console.error);
