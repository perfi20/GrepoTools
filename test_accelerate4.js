const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

const url = "prisma+postgres://d5c16c04a1cc5b723ab148ab4588f77da899858103184dbdf40b3c7f5d31fd06:sk_XogLb5PaolRtvEq3oVDq0@db.prisma.io:5432/postgres?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: { url }
  }
}).$extends(withAccelerate());

async function main() {
  console.time('Query 1');
  const count1 = await prisma.player.count({ cacheStrategy: { ttl: 60 } });
  console.timeEnd('Query 1');

  console.time('Query 2');
  const count2 = await prisma.player.count({ cacheStrategy: { ttl: 60 } });
  console.timeEnd('Query 2');
}

main().catch(console.error).finally(() => prisma.$disconnect());
