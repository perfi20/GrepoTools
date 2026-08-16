import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import zlib from 'zlib';
import { generateGeoJSON } from '@/lib/geojson';
import { generateScoreboardData } from '@/lib/scoreboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    let worldId = searchParams.get('world');
    
    if (!worldId) {
      try {
        const body = await request.json();
        if (body.world) worldId = body.world;
      } catch (e) {}
    }
    worldId = (worldId || 'hu119').toLowerCase();

    console.log(`Generating scoreboard and geoJson caches for world [${worldId}]...`);
    
    const [scoreboardData, geoJsonData] = await Promise.all([
      generateScoreboardData(worldId),
      generateGeoJSON(worldId)
    ]);
    
    const scoreboardGzip = zlib.gzipSync(JSON.stringify(scoreboardData)).toString('base64');
    const geoJsonGzip = zlib.gzipSync(JSON.stringify(geoJsonData)).toString('base64');
    
    await prisma.world.update({
      where: { id: worldId },
      data: { scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip }
    });

    await prisma.syncMetadata.upsert({
      where: { id: 1 },
      update: { worldId, scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip, lastSync: new Date() },
      create: { id: 1, worldId, scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip, lastSync: new Date() }
    });
    
    revalidatePath('/api/world/scoreboard');
    revalidatePath('/api/world/geojson');
    revalidatePath('/api/world/meta');

    return NextResponse.json({ success: true, worldId, message: `Caches rebuilt for world ${worldId}` });
  } catch (error) {
    console.error("Cache Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
