import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request, props) {
  const params = await props.params;
  const allianceId = parseInt(params.id, 10);

  if (isNaN(allianceId)) {
    return NextResponse.json({ error: 'Invalid alliance ID' }, { status: 400 });
  }

  try {
    const alliance = await prisma.alliance.findUnique({
      where: { id: allianceId }
    });

    if (!alliance) {
      return NextResponse.json({ error: 'Alliance not found' }, { status: 404 });
    }

    // 1. Fetch 7-day points history
    const historyDb = await prisma.allianceHistory.findMany({
      where: {
        allianceId,
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

    // 2. Fetch Conquest history where this alliance was oldAlliance or newAlliance
    const conquestsDb = await prisma.conquest.findMany({
      where: { OR: [{ oldAllianceId: allianceId }, { newAllianceId: allianceId }] },
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
      alliance,
      history,
      activity,
      conquests
    });

  } catch (error) {
    console.error("Alliance API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
