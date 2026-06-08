import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
  const townId = parseInt(params.id, 10);

  if (isNaN(townId)) {
    return NextResponse.json({ error: 'Invalid town ID' }, { status: 400 });
  }

  try {
    const town = await prisma.town.findUnique({
      where: { id: townId },
      include: {
        player: { include: { alliance: true } }
      }
    });

    if (!town) {
      return NextResponse.json({ error: 'Town not found' }, { status: 404 });
    }

    // 1. Fetch 7-day points history
    const historyDb = await prisma.townHistory.findMany({
      where: {
        townId,
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { timestamp: 'asc' }
    });

    const history = historyDb.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString(),
      points: h.newPoints,
      delta: h.newPoints - h.oldPoints,
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
      where: { townId },
      orderBy: { timestamp: 'desc' }
    });

    // We need to resolve player/alliance names for conquests, but let's query the minimal info
    // For now we assume conquest object might not have names saved.
    // Wait, the new conquest sync logic doesn't save names inside the Conquest table! 
    // It only saves oldPlayerId, newPlayerId, etc. We must resolve them here.
    
    // Collect unique IDs to resolve
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
      town,
      history,
      activity,
      conquests
    });

  } catch (error) {
    console.error("Town API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
