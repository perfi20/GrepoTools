import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch all towns to know which islands are populated
    const towns = await prisma.town.findMany({
      select: { islandX: true, islandY: true }
    });
    
    const populatedSet = new Set();
    for (const t of towns) {
      populatedSet.add(`${t.islandX},${t.islandY}`);
    }

    const allIslands = await prisma.island.findMany({ 
      select: { id: true, x: true, y: true, availableTowns: true } 
    });
    
    const toDelete = allIslands.filter(i => {
      const distSq = Math.pow(i.x - 500, 2) + Math.pow(i.y - 500, 2);
      const outside = distSq > 250 * 250;
      const hasTowns = populatedSet.has(`${i.x},${i.y}`);
      const emptyRock = i.availableTowns === 0 && !hasTowns;
      return outside || emptyRock;
    }).map(i => i.id);

    console.log(`Deleting ${toDelete.length} islands...`);
    
    for (let i = 0; i < toDelete.length; i += 10000) {
      const chunk = toDelete.slice(i, i + 10000);
      await prisma.island.deleteMany({ where: { id: { in: chunk } } });
      console.log(`Deleted chunk ${i}`);
    }

    return NextResponse.json({ success: true, deleted: toDelete.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
