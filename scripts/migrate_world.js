// Run schema migration and seed initial world
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Creating World table and initial world hu119 if not exists...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "World" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "server" TEXT NOT NULL,
      "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
      "unitSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
      "worldType" TEXT NOT NULL DEFAULT 'siege',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "lastSync" TIMESTAMP(3),
      "geoJsonCache" TEXT,
      "scoreboardCache" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "World" ("id", "name", "server", "speed", "unitSpeed", "worldType", "isActive", "lastSync")
    VALUES ('hu119', 'HU119 (Selymbria)', 'hu119', 3.0, 3.0, 'siege', true, NOW())
    ON CONFLICT ("id") DO NOTHING;
  `);

  console.log("Initial world created successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
