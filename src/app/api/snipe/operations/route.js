import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetTownId = searchParams.get('targetTownId');
    const worldId = (searchParams.get('world') || 'hu119').toLowerCase();
    
    let whereClause = { worldId };
    if (targetTownId) {
      whereClause.targetTownId = parseInt(targetTownId, 10);
    }

    const operations = await prisma.snipeOperation.findMany({
      where: whereClause,
      include: {
        targetTown: { select: { name: true, islandX: true, islandY: true } },
        originTown: { select: { name: true, islandX: true, islandY: true } }
      },
      orderBy: { sendTime: 'asc' }
    });

    return NextResponse.json(operations);
  } catch (error) {
    console.error("GET /api/snipe/operations error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { label, type, worldType, worldId = 'hu119', targetTownId, originTownId, targetReturnTime, sendTime, recallTime, notes } = body;

    if (!label || !targetTownId || !originTownId || !targetReturnTime || !sendTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newOp = await prisma.snipeOperation.create({
      data: {
        worldId: worldId.toLowerCase(),
        label,
        type: type || "recall",
        worldType: worldType || "siege",
        targetTownId: parseInt(targetTownId, 10),
        originTownId: parseInt(originTownId, 10),
        targetReturnTime: new Date(targetReturnTime),
        sendTime: new Date(sendTime),
        recallTime: recallTime ? new Date(recallTime) : null,
        notes: notes || null,
        status: "PENDING"
      }
    });

    return NextResponse.json(newOp);
  } catch (error) {
    console.error("POST /api/snipe/operations error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing operation ID' }, { status: 400 });
    }

    await prisma.snipeOperation.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/snipe/operations error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
