import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateGeoJSON } from '@/lib/geojson';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    
    if (meta && meta.geoJsonCache) {
      const etag = `W/"${meta.lastSync.getTime()}"`;
      if (request.headers.get('if-none-match') === etag) {
        return new NextResponse(null, { status: 304 });
      }

      // Decode Base64 from Postgres back into a raw binary GZIP buffer
      const gzipBuffer = Buffer.from(meta.geoJsonCache, 'base64');
      const uint8Array = new Uint8Array(gzipBuffer);
      
      // Serve the compressed binary buffer instantly!
      // The browser natively unzips it because we specify Content-Encoding: gzip
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          'ETag': etag,
          'X-Last-Sync': meta.lastSync.toISOString(),
        },
      });
    }

    const geojson = await generateGeoJSON();

    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'ETag': meta ? `W/"${meta.lastSync.getTime()}"` : `W/"${Date.now()}"`,
        'X-Last-Sync': meta ? meta.lastSync.toISOString() : new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GeoJSON generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
