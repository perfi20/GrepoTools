import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Pre-assign a specific color palette to the top 10 alliances
const PALETTE = [
  "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", 
  "#ec4899", "#eab308", "#06b6d4", "#84cc16", "#14b8a6"
];

export async function GET(request) {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 }, select: { lastSync: true } });
    if (meta) {
      const etag = `W/"${meta.lastSync.getTime()}"`;
      if (request.headers.get('if-none-match') === etag) {
        return new NextResponse(null, { status: 304 });
      }
    }

    // Execute all independent database queries concurrently to resolve N+1 blocking behavior
    const [dbAlliances, dbPlayers, totalPlayers, totalAlliances, totalTowns, totalIslands, populatedIslandsCoords] = await Promise.all([
      prisma.alliance.findMany({ orderBy: { towns: 'desc' }, take: 10 }),
      prisma.player.findMany({ orderBy: { points: 'desc' }, take: 10, include: { alliance: true } }),
      prisma.player.count(),
      prisma.alliance.count(),
      prisma.town.count(),
      prisma.island.count(),
      prisma.town.groupBy({ by: ['islandX', 'islandY'] })
    ]);
    
    const topAlliancesData = dbAlliances.map((a, i) => ({
      ...a,
      color: PALETTE[i] || "#ffffff"
    }));

    const topPlayersData = dbPlayers.map(p => ({
      ...p,
      alliance: p.alliance ? p.alliance.name : 'None'
    }));

    const populatedIslands = populatedIslandsCoords.length;
    const lastSyncStr = meta ? meta.lastSync.toISOString() : new Date().toISOString();

    return NextResponse.json({
      topAlliances: topAlliancesData,
      topPlayers: topPlayersData,
      stats: { 
        players: totalPlayers, 
        totalTowns, 
        totalIslands, 
        populatedIslands 
      },
      lastSync: lastSyncStr
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'ETag': meta ? `W/"${meta.lastSync.getTime()}"` : `W/"${Date.now()}"`
      }
    });

  } catch (error) {
    console.error("Meta API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
