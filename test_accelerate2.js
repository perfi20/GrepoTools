const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

const apiKey = 'sk_XogLb5PaolRtvEq3oVDq0'; // from the password field of the url
const accelerateUrl = `prisma://accelerate.prisma-data.net/?api_key=${apiKey}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: accelerateUrl
    }
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
