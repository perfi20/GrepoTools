import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCachedSyncEpoch } from '@/lib/syncMetadata';

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
    const epoch = await getCachedSyncEpoch();
    console.log(`[API /momentum] Executing Prisma Query with cache-buster epoch: ${epoch}`);

    const baseline = getBaselineTime();
    const windowBStart = new Date(baseline.getTime() - 24 * 60 * 60 * 1000);
    const windowBEnd = baseline;
    let results = [];

    const calculateGains = (history, idKey) => {
      const gains = {};
      history.forEach(h => {
        const id = h[idKey];
        if (!gains[id]) gains[id] = { pts: 0, abp: 0, dbp: 0 };
        gains[id].pts += (h.newPoints - h.oldPoints);
        gains[id].abp += h.abpDelta;
        gains[id].dbp += h.dbpDelta;
      });
      return gains;
    };

    const calcTrend = (valA, valB) => {
      if (valB === 0) return valA > 0 ? 100 : 0;
      let trend = ((valA - valB) / Math.abs(valB)) * 100;
      return Math.round(Math.max(-100, Math.min(100, trend)));
    };

    if (type === 'player') {
      const players = await prisma.player.findMany({
        cacheStrategy: { ttl: 3600, swr: 3600 },
        where: { name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 5,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } }
      });

      if (players.length > 0) {
        const pIds = players.map(p => p.id);
        const [historyA, historyB] = await Promise.all([
          prisma.playerHistory.findMany({ cacheStrategy: { ttl: 3600, swr: 3600 }, where: { playerId: { in: pIds }, timestamp: { gte: baseline }, id: { not: -epoch } } }),
          prisma.playerHistory.findMany({ cacheStrategy: { ttl: 3600, swr: 3600 }, where: { playerId: { in: pIds }, timestamp: { gte: windowBStart, lt: windowBEnd }, id: { not: -epoch } } })
        ]);

        const gainsA = calculateGains(historyA, 'playerId');
        const gainsB = calculateGains(historyB, 'playerId');

        results = players.map(p => ({
          ...p,
          momentumPts: gainsA[p.id]?.pts || 0,
          momentumAbp: gainsA[p.id]?.abp || 0,
          momentumDbp: gainsA[p.id]?.dbp || 0,
          trendPts: calcTrend(gainsA[p.id]?.pts || 0, gainsB[p.id]?.pts || 0),
          trendAbp: calcTrend(gainsA[p.id]?.abp || 0, gainsB[p.id]?.abp || 0),
          trendDbp: calcTrend(gainsA[p.id]?.dbp || 0, gainsB[p.id]?.dbp || 0),
          gainsAPts: gainsA[p.id]?.pts || 0,
          gainsAAbp: gainsA[p.id]?.abp || 0,
          gainsADbp: gainsA[p.id]?.dbp || 0,
          gainsBPts: gainsB[p.id]?.pts || 0,
          gainsBAbp: gainsB[p.id]?.abp || 0,
          gainsBDbp: gainsB[p.id]?.dbp || 0,
        }));
      }
    } else {
      const alliances = await prisma.alliance.findMany({
        cacheStrategy: { ttl: 3600, swr: 3600 },
        where: { name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 5,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true }
      });

      if (alliances.length > 0) {
        const aIds = alliances.map(a => a.id);
        const [historyA, historyB] = await Promise.all([
          prisma.allianceHistory.findMany({ cacheStrategy: { ttl: 3600, swr: 3600 }, where: { allianceId: { in: aIds }, timestamp: { gte: baseline }, id: { not: -epoch } } }),
          prisma.allianceHistory.findMany({ cacheStrategy: { ttl: 3600, swr: 3600 }, where: { allianceId: { in: aIds }, timestamp: { gte: windowBStart, lt: windowBEnd }, id: { not: -epoch } } })
        ]);

        const gainsA = calculateGains(historyA, 'allianceId');
        const gainsB = calculateGains(historyB, 'allianceId');

        results = alliances.map(a => ({
          ...a,
          momentumPts: gainsA[a.id]?.pts || 0,
          momentumAbp: gainsA[a.id]?.abp || 0,
          momentumDbp: gainsA[a.id]?.dbp || 0,
          trendPts: calcTrend(gainsA[a.id]?.pts || 0, gainsB[a.id]?.pts || 0),
          trendAbp: calcTrend(gainsA[a.id]?.abp || 0, gainsB[a.id]?.abp || 0),
          trendDbp: calcTrend(gainsA[a.id]?.dbp || 0, gainsB[a.id]?.dbp || 0),
          gainsAPts: gainsA[a.id]?.pts || 0,
          gainsAAbp: gainsA[a.id]?.abp || 0,
          gainsADbp: gainsA[a.id]?.dbp || 0,
          gainsBPts: gainsB[a.id]?.pts || 0,
          gainsBAbp: gainsB[a.id]?.abp || 0,
          gainsBDbp: gainsB[a.id]?.dbp || 0,
        }));
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Momentum Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
