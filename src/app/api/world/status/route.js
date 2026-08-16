import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const worldId = (searchParams.get('world') || 'hu119').toLowerCase();

  try {
    const world = await prisma.world.findUnique({
      where: { id: worldId },
      select: { lastSync: true, id: true, name: true, speed: true, worldType: true }
    });

    if (!world || !world.lastSync) {
      return NextResponse.json({ success: true, worldId, lastSync: null, world });
    }
    return NextResponse.json({ success: true, worldId, lastSync: world.lastSync, world });
  } catch (error) {
    console.error("World Status API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
