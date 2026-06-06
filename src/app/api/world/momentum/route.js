import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const getBaselineTime = () => {
  const now = new Date();
  const baseline = new Date(now);
  baseline.setHours(1, 50, 0, 0);
  if (now < baseline) {
    baseline.setDate(baseline.getDate() - 1);
  }
  return baseline;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type'); // 'player' or 'alliance'
  
  if (!q || q.length < 2 || !['player', 'alliance'].includes(type)) {
    return NextResponse.json({ results: [] });
  }

  try {
    const baseline = getBaselineTime();
    let results = [];

    if (type === 'player') {
      const players = await prisma.player.findMany({
        where: { name: { contains: q } },
        take: 5,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } }
      });

      if (players.length > 0) {
        const pIds = players.map(p => p.id);
        const history = await prisma.playerHistory.findMany({
          where: { playerId: { in: pIds }, timestamp: { gte: baseline } }
        });

        const gains = {};
        history.forEach(h => {
          if (!gains[h.playerId]) gains[h.playerId] = { pts: 0, abp: 0, dbp: 0 };
          gains[h.playerId].pts += (h.newPoints - h.oldPoints);
          gains[h.playerId].abp += h.abpDelta;
          gains[h.playerId].dbp += h.dbpDelta;
        });

        results = players.map(p => ({
          ...p,
          momentumPts: gains[p.id]?.pts || 0,
          momentumAbp: gains[p.id]?.abp || 0,
          momentumDbp: gains[p.id]?.dbp || 0,
        }));
      }
    } else {
      const alliances = await prisma.alliance.findMany({
        where: { name: { contains: q } },
        take: 5,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true }
      });

      if (alliances.length > 0) {
        const aIds = alliances.map(a => a.id);
        const history = await prisma.allianceHistory.findMany({
          where: { allianceId: { in: aIds }, timestamp: { gte: baseline } }
        });

        const gains = {};
        history.forEach(h => {
          if (!gains[h.allianceId]) gains[h.allianceId] = { pts: 0, abp: 0, dbp: 0 };
          gains[h.allianceId].pts += (h.newPoints - h.oldPoints);
          gains[h.allianceId].abp += h.abpDelta;
          gains[h.allianceId].dbp += h.dbpDelta;
        });

        results = alliances.map(a => ({
          ...a,
          momentumPts: gains[a.id]?.pts || 0,
          momentumAbp: gains[a.id]?.abp || 0,
          momentumDbp: gains[a.id]?.dbp || 0,
        }));
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Momentum Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
