const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

const prisma = new PrismaClient().$extends(withAccelerate());

async function main() {
  console.time('Query 1');
  const count1 = await prisma.player.count({ cacheStrategy: { ttl: 60 } });
  console.timeEnd('Query 1');

  console.time('Query 2');
  const count2 = await prisma.player.count({ cacheStrategy: { ttl: 60 } });
  console.timeEnd('Query 2');
}

main().finally(() => prisma.$disconnect());
