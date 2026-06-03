import { NextResponse } from 'next/server';
import { getCachedGeoJSON } from '@/lib/geojson';

export async function GET() {
  try {
    const geojson = await getCachedGeoJSON();

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
