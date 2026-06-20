import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateTravelTime } from '@/lib/traveltime';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin_id = parseInt(searchParams.get('origin_id'), 10);
    const duration = parseInt(searchParams.get('duration'), 10);
    const unit_speed = parseInt(searchParams.get('unit_speed'), 10);
    const world_speed = parseFloat(searchParams.get('world_speed'));

    if (isNaN(origin_id) || isNaN(duration) || isNaN(unit_speed) || isNaN(world_speed)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const originTown = await prisma.town.findUnique({
      where: { id: origin_id }
    });

    if (!originTown) {
      return NextResponse.json({ error: 'Origin town not found' }, { status: 404 });
    }

    // We need to find towns where travel time >= duration.
    // Optimization: Calculate max coordinate delta to limit the DB query bounding box.
    // formula: (distance * 500) / (speed * worldSpeed) >= duration - 300
    // distance >= ((duration - 300) * speed * worldSpeed) / 500
    const requiredDistance = Math.max(0, ((duration - 300) * unit_speed * world_speed) / 500);
    const boundingBoxDelta = Math.ceil(requiredDistance) + 20;

    const minX = originTown.islandX - boundingBoxDelta;
    const maxX = originTown.islandX + boundingBoxDelta;
    const minY = originTown.islandY - boundingBoxDelta;
    const maxY = originTown.islandY + boundingBoxDelta;

    const candidateTowns = await prisma.town.findMany({
      where: {
        islandX: { gte: minX, lte: maxX },
        islandY: { gte: minY, lte: maxY },
        id: { not: origin_id }
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
          ...target,
          travelTime: t
        });
      }
    }

    validTargets.sort((a, b) => a.travelTime - b.travelTime);

    return NextResponse.json(validTargets.slice(0, 10));

  } catch (error) {
    console.error("GET /api/snipe/dummy-targets error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
