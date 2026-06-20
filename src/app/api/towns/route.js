import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerIdStr = searchParams.get('playerId');

    if (!playerIdStr) {
      return NextResponse.json({ error: 'Missing playerId parameter' }, { status: 400 });
    }

    const playerId = parseInt(playerIdStr, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
    }

    const towns = await prisma.town.findMany({
      where: { playerId }
    });

    return NextResponse.json(towns);
  } catch (error) {
    console.error("GET /api/towns error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { townId, specialization, bunksResearched, plowResearched, cartographyResearched, mathResearched, hasThermalBaths, hasTower, hasLighthouse, buildingLevels } = body;

    if (!townId) {
      return NextResponse.json({ error: 'Missing townId' }, { status: 400 });
    }

    const id = parseInt(townId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid townId' }, { status: 400 });
    }

    const updateData = {};
    if (specialization !== undefined) updateData.specialization = specialization;
    if (bunksResearched !== undefined) updateData.bunksResearched = bunksResearched;
    if (plowResearched !== undefined) updateData.plowResearched = plowResearched;
    if (cartographyResearched !== undefined) updateData.cartographyResearched = cartographyResearched;
    if (mathResearched !== undefined) updateData.mathResearched = mathResearched;
    if (hasThermalBaths !== undefined) updateData.hasThermalBaths = hasThermalBaths;
    if (hasTower !== undefined) updateData.hasTower = hasTower;
    if (hasLighthouse !== undefined) updateData.hasLighthouse = hasLighthouse;

    if (buildingLevels) {
      if (buildingLevels.mainLevel !== undefined) updateData.mainLevel = buildingLevels.mainLevel;
      if (buildingLevels.farmLevel !== undefined) updateData.farmLevel = buildingLevels.farmLevel;
      if (buildingLevels.barracksLevel !== undefined) updateData.barracksLevel = buildingLevels.barracksLevel;
      if (buildingLevels.docksLevel !== undefined) updateData.docksLevel = buildingLevels.docksLevel;
      if (buildingLevels.wallLevel !== undefined) updateData.wallLevel = buildingLevels.wallLevel;
      if (buildingLevels.templeLevel !== undefined) updateData.templeLevel = buildingLevels.templeLevel;
      if (buildingLevels.lumberLevel !== undefined) updateData.lumberLevel = buildingLevels.lumberLevel;
      if (buildingLevels.stonerLevel !== undefined) updateData.stonerLevel = buildingLevels.stonerLevel;
      if (buildingLevels.ironerLevel !== undefined) updateData.ironerLevel = buildingLevels.ironerLevel;
      if (buildingLevels.marketLevel !== undefined) updateData.marketLevel = buildingLevels.marketLevel;
      if (buildingLevels.academyLevel !== undefined) updateData.academyLevel = buildingLevels.academyLevel;
    }

    const updatedTown = await prisma.town.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updatedTown);
  } catch (error) {
    console.error("PUT /api/towns error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
