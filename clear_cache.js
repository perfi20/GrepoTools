const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.syncMetadata.update({
    where: { id: 1 },
    data: { geoJsonCache: null }
  });
  console.log('Cache cleared!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
