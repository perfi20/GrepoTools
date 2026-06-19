import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getCachedSyncEpoch } from '@/lib/syncMetadata';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [], alliances: [] });
  }

  try {
    const epoch = await getCachedSyncEpoch();
    console.log(`[API /search] Executing Prisma Query with cache-buster epoch: ${epoch}`);

    const [players, alliances, towns] = await Promise.all([
      prisma.player.findMany({
        cacheStrategy: { ttl: 3600, swr: 3600 },
        where: { name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 10,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true, alliance: { select: { name: true } } }
      }),
      prisma.alliance.findMany({
        cacheStrategy: { ttl: 3600, swr: 3600 },
        where: { name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 10,
        select: { id: true, name: true, points: true, abp: true, dbp: true, allBp: true }
      }),
      prisma.town.findMany({
        cacheStrategy: { ttl: 3600, swr: 3600 },
        where: { name: { contains: q, mode: 'insensitive' }, id: { not: -epoch } },
        take: 10,
        select: { id: true, name: true, points: true, player: { select: { name: true } } }
      })
    ]);

    return NextResponse.json({ players, alliances, towns });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
