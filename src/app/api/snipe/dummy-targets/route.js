import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateTravelTime } from '@/lib/traveltime';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin_id = parseInt(searchParams.get('origin_id'), 10);
    const duration = parseInt(searchParams.get('duration'), 10);
    const unit_speed = parseInt(searchParams.get('unit_speed'), 10);
    const world_speed = parseFloat(searchParams.get('world_speed')) || 1.0;
    const worldId = (searchParams.get('world') || 'hu119').toLowerCase();

    if (isNaN(origin_id) || isNaN(duration) || isNaN(unit_speed) || isNaN(world_speed)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const originTown = await prisma.town.findFirst({
      where: { worldId, id: origin_id }
    });

    if (!originTown) {
      return NextResponse.json({ error: 'Origin town not found' }, { status: 404 });
    }

    // We need to find towns where travel time >= duration.
    const requiredDistance = Math.max(0, ((duration - 300) * unit_speed * world_speed) / 500);
    const boundingBoxDelta = Math.ceil(requiredDistance) + 25;

    const minX = originTown.islandX - boundingBoxDelta;
    const maxX = originTown.islandX + boundingBoxDelta;
    const minY = originTown.islandY - boundingBoxDelta;
    const maxY = originTown.islandY + boundingBoxDelta;

    const candidateTowns = await prisma.town.findMany({
      where: {
        worldId,
        islandX: { gte: minX, lte: maxX },
        islandY: { gte: minY, lte: maxY },
        id: { not: origin_id }
      },
      include: {
        player: { select: { name: true } }
      },
      take: 1000 
    });

    const modifiers = {
      cartographyResearched: originTown.cartographyResearched,
      hasLighthouse: originTown.hasLighthouse,
    };

    const validTargets = [];
    for (const target of candidateTowns) {
      const t = calculateTravelTime(originTown.islandX, originTown.islandY, target.islandX, target.islandY, unit_speed, world_speed, modifiers);
      if (t >= duration) {
        validTargets.push({
          id: target.id,
          name: target.name,
          islandX: target.islandX,
          islandY: target.islandY,
          points: target.points,
          playerName: target.player ? target.player.name : 'Ghost Town',
          travelTime: t
        });
      }
    }

    validTargets.sort((a, b) => a.travelTime - b.travelTime);

    return NextResponse.json(validTargets.slice(0, 15));

  } catch (error) {
    console.error("GET /api/snipe/dummy-targets error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
