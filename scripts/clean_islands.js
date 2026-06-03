const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
env.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim().replace(/"/g, '');
  }
});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  console.log("Fetching islands...");
  const allIslands = await prisma.island.findMany({ 
    select: { 
      id: true, 
      x: true, 
      y: true, 
      availableTowns: true, 
      _count: { select: { towns: true } } 
    } 
  });
  
  const toDelete = allIslands.filter(i => {
    const distSq = Math.pow(i.x - 500, 2) + Math.pow(i.y - 500, 2);
    const outside = distSq > 250 * 250;
    const emptyRock = i.availableTowns === 0 && i._count.towns === 0;
    return outside || emptyRock;
  }).map(i => i.id);

  console.log(`Found ${toDelete.length} unnecessary islands. Deleting in chunks...`);
  
  for (let i = 0; i < toDelete.length; i += 10000) {
    const chunk = toDelete.slice(i, i + 10000);
    await prisma.island.deleteMany({ where: { id: { in: chunk } } });
    console.log(`Deleted ${i + chunk.length} / ${toDelete.length}`);
  }
  console.log('Database cleanup complete.');
}

clean().finally(() => prisma.$disconnect());
