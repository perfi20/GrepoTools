import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    const islands = await prisma.island.findMany({
      include: {
        _count: {
          select: { towns: true }
        }
      }
    });

    console.log(`Total islands in DB: ${islands.length}`);

    // Let's sample a few populated islands to see what availableTowns means
    const populated = islands.filter(i => i._count.towns > 0);
    console.log(`Total populated islands: ${populated.length}`);
    
    console.log("Sample populated islands:");
    console.log(populated.slice(0, 10).map(i => `ID: ${i.id}, slots: ${i.availableTowns}, towns: ${i._count.towns}, X: ${i.x}, Y: ${i.y}`));
    
    // Find how many islands are outside radius 250
    const outside = islands.filter(i => {
      const distSq = Math.pow(i.x - 500, 2) + Math.pow(i.y - 500, 2);
      return distSq > 250 * 250;
    });
    console.log(`Islands outside radius 250: ${outside.length}`);

    // How many empty rocks
    const emptyRocks = islands.filter(i => i.availableTowns === 0 && i._count.towns === 0);
    console.log(`Empty rocks (0 slots, 0 towns): ${emptyRocks.length}`);
    
    const uncolonizable = islands.filter(i => i.availableTowns < 20 && i._count.towns === 0);
    console.log(`Uncolonizable islands (< 20 slots, 0 towns): ${uncolonizable.length}`);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
