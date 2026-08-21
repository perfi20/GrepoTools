import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const x = parseInt(searchParams.get('x'), 10);
  const y = parseInt(searchParams.get('y'), 10);
  const worldId = (searchParams.get('world') || 'hu119').toLowerCase();

  if (isNaN(x) || isNaN(y)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    const island = await prisma.island.findFirst({
      where: { worldId, x, y }
    });

    if (!island) {
      return NextResponse.json({ error: 'Island not found' }, { status: 404 });
    }

    const towns = await prisma.town.findMany({
      where: { worldId, islandX: x, islandY: y },
      include: {
        player: {
          include: {
            alliance: true
          }
        }
      },
      orderBy: { islandSlot: 'asc' }
    });

    const townIds = towns.map(t => t.id);
    const townHistories = townIds.length > 0 ? await prisma.townHistory.findMany({
      where: {
        worldId,
        townId: { in: townIds },
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { timestamp: 'asc' }
    }) : [];

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

    const conquestsDb = townIds.length > 0 ? await prisma.conquest.findMany({
      where: {
        worldId,
        townId: { in: townIds },
        timestamp: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    }) : [];

    const pIds = new Set();
    const aIds = new Set();
    conquestsDb.forEach(c => {
      if (c.oldPlayerId) pIds.add(c.oldPlayerId);
      if (c.newPlayerId) pIds.add(c.newPlayerId);
      if (c.oldAllianceId) aIds.add(c.oldAllianceId);
      if (c.newAllianceId) aIds.add(c.newAllianceId);
    });

    const players = pIds.size > 0 ? await prisma.player.findMany({ where: { worldId, id: { in: Array.from(pIds) } }, select: { id: true, name: true }}) : [];
    const alliances = aIds.size > 0 ? await prisma.alliance.findMany({ where: { worldId, id: { in: Array.from(aIds) } }, select: { id: true, name: true }}) : [];
    
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
