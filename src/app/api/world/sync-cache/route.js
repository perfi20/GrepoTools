import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import zlib from 'zlib';
import { generateGeoJSON } from '@/lib/geojson';
import { generateScoreboardData } from '@/lib/scoreboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for cache generation on Vercel

export async function POST(request) {
  try {
    console.log("Generating scoreboard and geoJson caches asynchronously...");
    
    // We run both generators in parallel for speed
    const [scoreboardData, geoJsonData] = await Promise.all([
      generateScoreboardData(),
      generateGeoJSON()
    ]);
    
    const scoreboardGzip = zlib.gzipSync(JSON.stringify(scoreboardData)).toString('base64');
    const geoJsonGzip = zlib.gzipSync(JSON.stringify(geoJsonData)).toString('base64');
    
    // Update sync metadata with the new cache payloads
    await prisma.syncMetadata.upsert({
      where: { id: 1 },
      update: { scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip },
      create: { id: 1, scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip }
    });
    
    console.log("Async Cache Sync metadata updated successfully!");

    revalidatePath('/api/world/scoreboard');
    revalidatePath('/api/world/geojson');
    revalidatePath('/api/world/meta');
    console.log("Edge caches revalidated successfully!");

    return NextResponse.json({ success: true, message: 'Caches rebuilt' });
  } catch (error) {
    console.error("Cache Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
