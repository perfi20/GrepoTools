import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-static';

const getBaselineTime = () => {
  const now = new Date();
  const baseline = new Date(now);
  baseline.setHours(1, 50, 0, 0); // 01:50:00 AM local time
  if (now < baseline) {
    // If it's 00:30 AM right now, the baseline was 01:50 AM *yesterday*
    baseline.setDate(baseline.getDate() - 1);
  }
  return baseline;
};

export async function GET() {
  try {
    const [
      topPlayersPts, topPlayersABP, topPlayersDBP, topPlayersAllBP,
      topAlliancesPts, topAlliancesABP, topAlliancesDBP, topAlliancesAllBP,
      recentConquests,
      historyPlayers24h,
      historyAlliances24h
    ] = await Promise.all([
      // Players Top 10s
      prisma.player.findMany({ orderBy: { points: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } } }),
      prisma.player.findMany({ orderBy: { abp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } } }),
      prisma.player.findMany({ orderBy: { dbp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } } }),
      prisma.player.findMany({ orderBy: { allBp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } } }),
      
      // Alliances Top 10s
      prisma.alliance.findMany({ orderBy: { points: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true } }),
      prisma.alliance.findMany({ orderBy: { abp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true } }),
      prisma.alliance.findMany({ orderBy: { dbp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true } }),
      prisma.alliance.findMany({ orderBy: { allBp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true } }),
      
      // Conquests (last 50)
      prisma.conquest.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50
      }),

      // Daily Momentum History (Baseline: 01:50:00 AM)
      prisma.playerHistory.findMany({
        where: { timestamp: { gte: getBaselineTime() } }
      }),
      prisma.allianceHistory.findMany({
        where: { timestamp: { gte: getBaselineTime() } }
      })
    ]);

    // Format Conquests
    const playerIds = new Set();
    const allianceIds = new Set();
    const townIds = new Set();

    recentConquests.forEach(c => {
      if (c.oldPlayerId) playerIds.add(c.oldPlayerId);
      if (c.newPlayerId) playerIds.add(c.newPlayerId);
      if (c.oldAllianceId) allianceIds.add(c.oldAllianceId);
      if (c.newAllianceId) allianceIds.add(c.newAllianceId);
      townIds.add(c.townId);
    });

    const [playersMapData, alliancesMapData, townsMapData] = await Promise.all([
      prisma.player.findMany({ where: { id: { in: Array.from(playerIds) } }, select: { id: true, name: true } }),
      prisma.alliance.findMany({ where: { id: { in: Array.from(allianceIds) } }, select: { id: true, name: true } }),
      prisma.town.findMany({ where: { id: { in: Array.from(townIds) } }, select: { id: true, name: true } })
    ]);

    const playerMap = new Map(playersMapData.map(p => [p.id, p.name]));
    const allianceMap = new Map(alliancesMapData.map(a => [a.id, a.name]));
    const townMap = new Map(townsMapData.map(t => [t.id, t.name]));

    const enrichedConquests = recentConquests.map(c => ({
      id: c.id,
      timestamp: c.timestamp,
      townName: townMap.get(c.townId) || 'Unknown Town',
      townPoints: c.townPoints,
      oldPlayer: c.oldPlayerId ? playerMap.get(c.oldPlayerId) : 'Ghost Town',
      newPlayer: c.newPlayerId ? playerMap.get(c.newPlayerId) : 'Unknown Player',
      oldAlliance: c.oldAllianceId ? allianceMap.get(c.oldAllianceId) : 'None',
      newAlliance: c.newAllianceId ? allianceMap.get(c.newAllianceId) : 'None'
    }));

    // Process 24h Gainers (Momentum)
    const playerGains = {};
    historyPlayers24h.forEach(h => {
      if (!playerGains[h.playerId]) playerGains[h.playerId] = { pts: 0, abp: 0, dbp: 0, allBp: 0 };
      playerGains[h.playerId].pts += (h.newPoints - h.oldPoints);
      playerGains[h.playerId].abp += h.abpDelta;
      playerGains[h.playerId].dbp += h.dbpDelta;
      playerGains[h.playerId].allBp += h.allBpDelta;
    });

    const allianceGains = {};
    historyAlliances24h.forEach(h => {
      if (!allianceGains[h.allianceId]) allianceGains[h.allianceId] = { pts: 0, abp: 0, dbp: 0, allBp: 0 };
      allianceGains[h.allianceId].pts += (h.newPoints - h.oldPoints);
      allianceGains[h.allianceId].abp += h.abpDelta;
      allianceGains[h.allianceId].dbp += h.dbpDelta;
      allianceGains[h.allianceId].allBp += h.allBpDelta;
    });

    const gainerPIds = Object.keys(playerGains).map(Number);
    const gainerAIds = Object.keys(allianceGains).map(Number);

      // Window A (Current Day)
      prisma.playerHistory.findMany({ where: { timestamp: { gte: baseline } } }),
      prisma.allianceHistory.findMany({ where: { timestamp: { gte: baseline } } }),
      // Window B (Previous Day)
      prisma.playerHistory.findMany({ where: { timestamp: { gte: windowBStart, lt: windowBEnd } } }),
      prisma.allianceHistory.findMany({ where: { timestamp: { gte: windowBStart, lt: windowBEnd } } })
    ]);

    // Fast lookups
    const gpMap = new Map();
    players.forEach(p => gpMap.set(p.id, p));
    const gaMap = new Map();
    alliances.forEach(a => gaMap.set(a.id, a));

    // Enrich Conquests & Count
    const pConquests = {};
    const pLosses = {};
    const aConquests = {};
    const aLosses = {};

    const enrichedConquests = conquests.map(c => {
      const np = gpMap.get(c.newPlayerId);
      const op = gpMap.get(c.oldPlayerId);
      const na = gaMap.get(c.newAllianceId);
      const oa = gaMap.get(c.oldAllianceId);
      
      if (c.newPlayerId) pConquests[c.newPlayerId] = (pConquests[c.newPlayerId] || 0) + 1;
      if (c.oldPlayerId) pLosses[c.oldPlayerId] = (pLosses[c.oldPlayerId] || 0) + 1;
      if (c.newAllianceId) aConquests[c.newAllianceId] = (aConquests[c.newAllianceId] || 0) + 1;
      if (c.oldAllianceId) aLosses[c.oldAllianceId] = (aLosses[c.oldAllianceId] || 0) + 1;

      return {
        ...c,
        newPlayer: np ? np.name : null,
        oldPlayer: op ? op.name : null,
        newAlliance: na ? na.name : null,
        oldAlliance: oa ? oa.name : null,
      };
    });

    const calculateGains = (history) => {
      const gains = {};
      history.forEach(h => {
        const id = h.playerId || h.allianceId;
        if (!gains[id]) gains[id] = { pts: 0, abp: 0, dbp: 0 };
        gains[id].pts += (h.newPoints - h.oldPoints);
        gains[id].abp += h.abpDelta;
        gains[id].dbp += h.dbpDelta;
      });
      return gains;
    };

    const playerGainsA = calculateGains(playerHistoryA);
    const allianceGainsA = calculateGains(allianceHistoryA);
    const playerGainsB = calculateGains(playerHistoryB);
    const allianceGainsB = calculateGains(allianceHistoryB);

    const calcTrend = (valA, valB) => {
      if (valB === 0) return valA > 0 ? 100 : 0;
      let trend = ((valA - valB) / Math.abs(valB)) * 100;
      return Math.round(Math.max(-100, Math.min(100, trend)));
    };

    const attachTrendsAndGetTop = (entitiesMap, gainsA, gainsB, sortKey) => {
      return Array.from(entitiesMap.values())
        .sort((a, b) => b[sortKey] - a[sortKey])
        .slice(0, 10)
        .map(e => ({
          ...e,
          trendPts: calcTrend(gainsA[e.id]?.pts || 0, gainsB[e.id]?.pts || 0),
          trendAbp: calcTrend(gainsA[e.id]?.abp || 0, gainsB[e.id]?.abp || 0),
          trendDbp: calcTrend(gainsA[e.id]?.dbp || 0, gainsB[e.id]?.dbp || 0)
        }));
    };

    const formatGainerList = (gainsDict, entityMap, sortKey) => {
      return Object.entries(gainsDict)
        .map(([id, gains]) => {
          const entity = entityMap.get(parseInt(id));
          if (!entity) return null;
          return {
            ...entity,
            momentum: gains[sortKey]
          };
        })
        .filter(item => item !== null && item.momentum > 0)
        .sort((a, b) => b.momentum - a.momentum)
        .slice(0, 15);
    };

    const formatCounts = (countsDict, entityMap) => {
       return Object.entries(countsDict)
         .map(([id, count]) => {
            const entity = entityMap.get(parseInt(id));
            if (!entity) return null;
            return { ...entity, count };
         })
         .filter(item => item !== null)
         .sort((a, b) => b.count - a.count)
         .slice(0, 10);
    };

    return NextResponse.json({
      players: {
        pts: attachTrendsAndGetTop(gpMap, playerGainsA, playerGainsB, 'points'),
        abp: attachTrendsAndGetTop(gpMap, playerGainsA, playerGainsB, 'abp'),
        dbp: attachTrendsAndGetTop(gpMap, playerGainsA, playerGainsB, 'dbp'),
        allbp: attachTrendsAndGetTop(gpMap, playerGainsA, playerGainsB, 'allBp'),
        momentumPts: formatGainerList(playerGainsA, gpMap, 'pts'),
        momentumAbp: formatGainerList(playerGainsA, gpMap, 'abp'),
        momentumDbp: formatGainerList(playerGainsA, gpMap, 'dbp'),
        conquests: formatCounts(pConquests, gpMap),
        losses: formatCounts(pLosses, gpMap)
      },
      alliances: {
        pts: attachTrendsAndGetTop(gaMap, allianceGainsA, allianceGainsB, 'points'),
        abp: attachTrendsAndGetTop(gaMap, allianceGainsA, allianceGainsB, 'abp'),
        dbp: attachTrendsAndGetTop(gaMap, allianceGainsA, allianceGainsB, 'dbp'),
        allbp: attachTrendsAndGetTop(gaMap, allianceGainsA, allianceGainsB, 'allBp'),
        momentumPts: formatGainerList(allianceGainsA, gaMap, 'pts'),
        momentumAbp: formatGainerList(allianceGainsA, gaMap, 'abp'),
        momentumDbp: formatGainerList(allianceGainsA, gaMap, 'dbp'),
        conquests: formatCounts(aConquests, gaMap),
        losses: formatCounts(aLosses, gaMap)
      },
      conquests: enrichedConquests,
    });

  } catch (error) {
    console.error("Scoreboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
