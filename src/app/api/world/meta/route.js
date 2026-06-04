import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-static';

// Pre-assign a specific color palette to the top 10 alliances
const PALETTE = [
  "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", 
  "#ec4899", "#eab308", "#06b6d4", "#84cc16", "#14b8a6"
];

export async function GET() {
  try {
    // 1. Get Top 10 Alliances
    const dbAlliances = await prisma.alliance.findMany({
      orderBy: { towns: 'desc' },
      take: 10,
      select: { name: true }
    });
    
    const topAlliancesData = dbAlliances.map((a, i) => ({
      name: a.name,
      color: PALETTE[i] || "#ffffff"
    }));

    // 2. Get Top 10 Players
    const dbPlayers = await prisma.player.findMany({
      orderBy: { points: 'desc' },
      take: 10,
      select: { 
        name: true, 
        points: true, 
        towns: true, 
        alliance: { select: { name: true } } 
      }
    });
    
    const topPlayersData = dbPlayers.map(p => ({
      name: p.name,
      points: p.points,
      towns: p.towns,
      alliance: p.alliance ? p.alliance.name : 'None'
    }));

    // 3. Get World Stats
    const totalPlayers = await prisma.player.count();
    const totalAlliances = await prisma.alliance.count();
    const totalTowns = await prisma.town.count();
    const totalIslands = await prisma.island.count();
    
    // Number of islands that have at least one town
    const populatedIslandsCoords = await prisma.town.groupBy({
      by: ['islandX', 'islandY'],
    });
    const populatedIslands = populatedIslandsCoords.length;

    // 4. Get Last Sync
    const meta = await prisma.syncMetadata.findUnique({
      where: { id: 1 },
      select: { lastSync: true }
    });

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
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });

  } catch (error) {
    console.error("Meta API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
