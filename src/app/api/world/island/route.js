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

    // Fetch Recent Conquests for these Towns
    const conquestsDb = await prisma.conquest.findMany({
      where: {
        townId: { in: townIds },
        timestamp: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // Last 14 days
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    const pIds = new Set();
    const aIds = new Set();
    conquestsDb.forEach(c => {
      if (c.oldPlayerId) pIds.add(c.oldPlayerId);
      if (c.newPlayerId) pIds.add(c.newPlayerId);
      if (c.oldAllianceId) aIds.add(c.oldAllianceId);
      if (c.newAllianceId) aIds.add(c.newAllianceId);
    });

    const players = await prisma.player.findMany({ where: { id: { in: Array.from(pIds) } }, select: { id: true, name: true }});
    const alliances = await prisma.alliance.findMany({ where: { id: { in: Array.from(aIds) } }, select: { id: true, name: true }});
    
    const pMap = new Map(players.map(p => [p.id, p]));
    const aMap = new Map(alliances.map(a => [a.id, a]));

    const conquests = conquestsDb.map(c => ({
      ...c,
      oldPlayerObj: c.oldPlayerId ? pMap.get(c.oldPlayerId) : null,
      newPlayerObj: c.newPlayerId ? pMap.get(c.newPlayerId) : null,
      oldAllianceObj: c.oldAllianceId ? aMap.get(c.oldAllianceId) : null,
      newAllianceObj: c.newAllianceId ? aMap.get(c.newAllianceId) : null
    }));

    return NextResponse.json({
      island,
      towns: towns.map(t => ({
        ...t,
        activity: activityMap[t.id]
      })),
      conquests
    });

  } catch (error) {
    console.error("Island Details API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
