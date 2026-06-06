import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const [
      topPlayersPts, topPlayersABP, topPlayersDBP,
      topAlliancesPts, topAlliancesABP, topAlliancesDBP,
      recentConquests,
      recentPlayerHistory,
      recentAllianceHistory
    ] = await Promise.all([
      // Players
      prisma.player.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, orderBy: { points: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, alliance: { select: { name: true } } } }),
      prisma.player.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, orderBy: { abp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, alliance: { select: { name: true } } } }),
      prisma.player.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, orderBy: { dbp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true, alliance: { select: { name: true } } } }),
      
      // Alliances
      prisma.alliance.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, orderBy: { points: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true } }),
      prisma.alliance.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, orderBy: { abp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true } }),
      prisma.alliance.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, orderBy: { dbp: 'desc' }, take: 10, select: { id: true, name: true, points: true, abp: true, dbp: true } }),
      
      // Conquests (last 50)
      prisma.conquest.findMany({
        cacheStrategy: { ttl: 600, swr: 60 },
        orderBy: { timestamp: 'desc' },
        take: 50
      }),

      // History for gainers (last 3 hours just to be safe)
      prisma.playerHistory.findMany({
        cacheStrategy: { ttl: 600, swr: 60 },
        where: { timestamp: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } }
      }),
      prisma.allianceHistory.findMany({
        cacheStrategy: { ttl: 600, swr: 60 },
        where: { timestamp: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } }
      })
    ]);

    // To get names for conquests, we need to fetch the relevant entities
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
      prisma.player.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, where: { id: { in: Array.from(playerIds) } }, select: { id: true, name: true } }),
      prisma.alliance.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, where: { id: { in: Array.from(allianceIds) } }, select: { id: true, name: true } }),
      prisma.town.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, where: { id: { in: Array.from(townIds) } }, select: { id: true, name: true } })
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

    // Process Gainers
    // Group by ID, sum deltas
    const playerGains = {};
    recentPlayerHistory.forEach(h => {
      if (!playerGains[h.playerId]) playerGains[h.playerId] = { pts: 0, abp: 0, dbp: 0 };
      playerGains[h.playerId].pts += (h.newPoints - h.oldPoints);
      playerGains[h.playerId].abp += h.abpDelta;
      playerGains[h.playerId].dbp += h.dbpDelta;
    });

    const allianceGains = {};
    recentAllianceHistory.forEach(h => {
      if (!allianceGains[h.allianceId]) allianceGains[h.allianceId] = { pts: 0, abp: 0, dbp: 0 };
      allianceGains[h.allianceId].pts += (h.newPoints - h.oldPoints);
      allianceGains[h.allianceId].abp += h.abpDelta;
      allianceGains[h.allianceId].dbp += h.dbpDelta;
    });

    // To get names for top gainers, fetch them
    const gainerPIds = Object.keys(playerGains).map(Number);
    const gainerAIds = Object.keys(allianceGains).map(Number);

    const [gainerPlayers, gainerAlliances] = await Promise.all([
      prisma.player.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, where: { id: { in: gainerPIds } }, select: { id: true, name: true, alliance: { select: { name: true } } } }),
      prisma.alliance.findMany({ cacheStrategy: { ttl: 600, swr: 60 }, where: { id: { in: gainerAIds } }, select: { id: true, name: true } })
    ]);

    const gpMap = new Map(gainerPlayers.map(p => [p.id, p]));
    const gaMap = new Map(gainerAlliances.map(a => [a.id, a]));

    const formatGainerList = (gainsDict, entityMap, sortKey) => {
      return Object.entries(gainsDict)
        .map(([id, gains]) => ({
          id: parseInt(id),
          entity: entityMap.get(parseInt(id)),
          ...gains
        }))
        .filter(item => item.entity) // Ensure entity exists
        .sort((a, b) => b[sortKey] - a[sortKey])
        .slice(0, 10);
    };

    return NextResponse.json({
      topPlayers: { pts: topPlayersPts, abp: topPlayersABP, dbp: topPlayersDBP },
      topAlliances: { pts: topAlliancesPts, abp: topAlliancesABP, dbp: topAlliancesDBP },
      conquests: enrichedConquests,
      gainers: {
        players: {
          pts: formatGainerList(playerGains, gpMap, 'pts'),
          abp: formatGainerList(playerGains, gpMap, 'abp'),
          dbp: formatGainerList(playerGains, gpMap, 'dbp')
        },
        alliances: {
          pts: formatGainerList(allianceGains, gaMap, 'pts'),
          abp: formatGainerList(allianceGains, gaMap, 'abp'),
          dbp: formatGainerList(allianceGains, gaMap, 'dbp')
        }
      }
    });

  } catch (error) {
    console.error("Scoreboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
