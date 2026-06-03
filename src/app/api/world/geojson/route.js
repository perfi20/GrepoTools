import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateGeoJSON } from '@/lib/geojson';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    
    if (meta && meta.geoJsonCache) {
      // Decode Base64 from Postgres back into a raw binary GZIP buffer
      const gzipBuffer = Buffer.from(meta.geoJsonCache, 'base64');
      
      // Serve the compressed binary buffer instantly!
      // The browser natively unzips it because we specify Content-Encoding: gzip
      return new NextResponse(gzipBuffer, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Fallback if cache is empty (We don't gzip the fallback to keep it simple, just return raw JSON)
    const geojson = await generateGeoJSON();

    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("GeoJSON generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
