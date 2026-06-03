import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateGeoJSON } from '@/lib/geojson';

export async function GET() {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    
    if (meta && meta.geoJsonCache) {
      // 0ms string transmission from DB directly to Vercel response
      return new NextResponse(meta.geoJsonCache, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Fallback if cache is empty
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
