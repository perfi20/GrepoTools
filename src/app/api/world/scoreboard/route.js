import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-static';

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

      // 24h Momentum History
      prisma.playerHistory.findMany({
        where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      }),
      prisma.allianceHistory.findMany({
        where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
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

    const [gainerPlayers, gainerAlliances] = await Promise.all([
      prisma.player.findMany({ where: { id: { in: gainerPIds } }, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } } }),
      prisma.alliance.findMany({ where: { id: { in: gainerAIds } }, select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true } })
    ]);

    const gpMap = new Map(gainerPlayers.map(p => [p.id, p]));
    const gaMap = new Map(gainerAlliances.map(a => [a.id, a]));

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

    return NextResponse.json({
      players: {
        pts: topPlayersPts,
        abp: topPlayersABP,
        dbp: topPlayersDBP,
        allbp: topPlayersAllBP,
        momentumPts: formatGainerList(playerGains, gpMap, 'pts'),
        momentumAbp: formatGainerList(playerGains, gpMap, 'abp'),
        momentumDbp: formatGainerList(playerGains, gpMap, 'dbp')
      },
      alliances: {
        pts: topAlliancesPts,
        abp: topAlliancesABP,
        dbp: topAlliancesDBP,
        allbp: topAlliancesAllBP,
        momentumPts: formatGainerList(allianceGains, gaMap, 'pts'),
        momentumAbp: formatGainerList(allianceGains, gaMap, 'abp'),
        momentumDbp: formatGainerList(allianceGains, gaMap, 'dbp')
      },
      conquests: enrichedConquests,
    });

  } catch (error) {
    console.error("Scoreboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
