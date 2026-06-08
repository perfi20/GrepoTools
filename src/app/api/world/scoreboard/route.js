import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateScoreboardData } from '@/lib/scoreboard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    
    if (meta && meta.scoreboardCache) {
      const etag = `W/"${meta.lastSync.getTime()}"`;
      if (request.headers.get('if-none-match') === etag) {
        return new NextResponse(null, { status: 304 });
      }

      // Decode Base64 from Postgres back into a raw binary GZIP buffer
      const gzipBuffer = Buffer.from(meta.scoreboardCache, 'base64');
      const uint8Array = new Uint8Array(gzipBuffer);
      
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
          'ETag': etag,
          'X-Last-Sync': meta.lastSync.toISOString(),
        },
      });
    }

    // Fallback if cache is not ready yet
    const data = await generateScoreboardData();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
        'ETag': meta ? `W/"${meta.lastSync.getTime()}"` : `W/"${Date.now()}"`,
        'X-Last-Sync': meta ? meta.lastSync.toISOString() : new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Scoreboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
