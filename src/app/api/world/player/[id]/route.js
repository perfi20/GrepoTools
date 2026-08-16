import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request, props) {
  const params = await props.params;
  const playerId = parseInt(params.id, 10);
  const { searchParams } = new URL(request.url);
  const worldId = (searchParams.get('world') || 'hu119').toLowerCase();

  if (isNaN(playerId)) {
    return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 });
  }

  try {
    const player = await prisma.player.findFirst({
      where: { worldId, id: playerId },
      include: { 
        alliance: true,
        townsList: {
          where: { worldId },
          orderBy: { points: 'desc' }
        }
      }
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // 1. Fetch 7-day points history
    const historyDb = await prisma.playerHistory.findMany({
      where: {
        worldId,
        playerId,
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { timestamp: 'asc' }
    });

    const history = historyDb.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString(),
      points: h.newPoints,
      delta: h.newPoints - h.oldPoints,
      abpDelta: h.abpDelta,
      dbpDelta: h.dbpDelta,
      timestamp: h.timestamp
    }));

    // Calculate overall 7-day activity delta
    let activity = { pointDelta: 0, lastActive: null };
    if (historyDb.length > 0) {
      const oldest = historyDb[0];
      const newest = historyDb[historyDb.length - 1];
      activity = {
        pointDelta: newest.newPoints - oldest.oldPoints,
        lastActive: newest.timestamp
      };
    }

    // 2. Fetch Conquest history
    const conquestsDb = await prisma.conquest.findMany({
      where: { worldId, OR: [{ oldPlayerId: playerId }, { newPlayerId: playerId }] },
      orderBy: { timestamp: 'desc' }
    });

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
      player,
      history,
      activity,
      conquests
    });

  } catch (error) {
    console.error("Player API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
