import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCachedSyncEpoch } from '@/lib/syncMetadata';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const worldId = (searchParams.get('world') || 'hu119').toLowerCase();
  
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [], alliances: [], towns: [] });
  }

  try {
    const epoch = await getCachedSyncEpoch(worldId);

    const [players, alliances, towns] = await Promise.all([
      prisma.player.findMany({
        where: { worldId, name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 10,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } }
      }),
      prisma.alliance.findMany({
        where: { worldId, name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 10,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true }
      }),
      prisma.town.findMany({
        where: { worldId, name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 10,
        select: { id: true, name: true, points: true, islandX: true, islandY: true, player: { select: { name: true } } }
      })
    ]);

    return NextResponse.json({ players, alliances, towns });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
