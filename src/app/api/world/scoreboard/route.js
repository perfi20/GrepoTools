import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateScoreboardData } from '@/lib/scoreboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    
    if (meta && meta.scoreboardCache) {
      // Decode Base64 from Postgres back into a raw binary GZIP buffer
      const gzipBuffer = Buffer.from(meta.scoreboardCache, 'base64');
      
      return new NextResponse(gzipBuffer, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'X-Last-Sync': meta.lastSync.toISOString(),
        },
      });
    }

    // Fallback if cache is not ready yet
    const data = await generateScoreboardData();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Last-Sync': meta ? meta.lastSync.toISOString() : new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Scoreboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
