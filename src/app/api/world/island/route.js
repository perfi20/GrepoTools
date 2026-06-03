import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const x = parseInt(searchParams.get('x'), 10);
  const y = parseInt(searchParams.get('y'), 10);

  if (isNaN(x) || isNaN(y)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    // Fetch Island Info
    const island = await prisma.island.findFirst({
      where: { x, y }
    });

    if (!island) {
      return NextResponse.json({ error: 'Island not found' }, { status: 404 });
    }

    // Fetch Towns on this Island, including Player, Alliance, and Recent History
    const towns = await prisma.town.findMany({
      where: { islandX: x, islandY: y },
      include: {
        player: {
          include: {
            alliance: true
          }
        }
      },
      orderBy: { islandSlot: 'asc' }
    });

    // We also want to determine "Activity" (e.g. points delta over the last 24h/7d)
    // For now, we'll fetch TownHistory for these specific towns
    const townIds = towns.map(t => t.id);
    const townHistories = await prisma.townHistory.findMany({
      where: {
        townId: { in: townIds },
        // Look at the last 7 days of history, for example
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Aggregate History to get Point Deltas
    const activityMap = {};
    for (const t of towns) {
      const hist = townHistories.filter(h => h.townId === t.id);
      if (hist.length > 0) {
        const oldest = hist[0];
        const newest = hist[hist.length - 1];
        activityMap[t.id] = {
          pointDelta: newest.newPoints - oldest.oldPoints,
          lastActive: newest.timestamp
        };
      } else {
        activityMap[t.id] = { pointDelta: 0, lastActive: null };
      }
    }

    // Fetch Recent Reports for these Towns
    const townNames = towns.map(t => t.name);
    const reports = await prisma.report.findMany({
      where: {
        OR: [
          { attackerTown: { in: townNames } },
          { defenderTown: { in: townNames } }
        ],
        date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // Last 14 days
      },
      orderBy: { date: 'desc' },
      take: 20
    });

    return NextResponse.json({
      island,
      towns: towns.map(t => ({
        ...t,
        activity: activityMap[t.id]
      })),
      reports
    });

  } catch (error) {
    console.error("Island Details API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
