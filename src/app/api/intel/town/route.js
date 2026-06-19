import { NextResponse } from 'next/server';
import { getTownIntel } from '@/lib/grepodata';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const world = searchParams.get('world');
  const townId = searchParams.get('town_id');

  if (!world || !townId) {
    return NextResponse.json({ error: 'Missing world or town_id' }, { status: 400 });
  }

  try {
    const data = await getTownIntel(world, townId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching town intel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
