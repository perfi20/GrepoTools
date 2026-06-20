import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetTownId = searchParams.get('targetTownId');
    
    let whereClause = {};
    if (targetTownId) {
      whereClause.targetTownId = parseInt(targetTownId, 10);
    }

    const operations = await prisma.snipeOperation.findMany({
      where: whereClause,
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
    const { label, type, worldType, targetTownId, originTownId, targetReturnTime, sendTime, recallTime } = body;

    if (!label || !targetTownId || !originTownId || !targetReturnTime || !sendTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newOp = await prisma.snipeOperation.create({
      data: {
        label,
        type: type || "recall",
        worldType: worldType || "siege",
        targetTownId: parseInt(targetTownId, 10),
        originTownId: parseInt(originTownId, 10),
        targetReturnTime: new Date(targetReturnTime),
        sendTime: new Date(sendTime),
        recallTime: recallTime ? new Date(recallTime) : null,
        status: "PENDING"
      }
    });

    return NextResponse.json(newOp);
  } catch (error) {
    console.error("POST /api/snipe/operations error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
