import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const masterPlayerName = process.env.NEXT_PUBLIC_MASTER_PLAYER_NAME || 'perfi';
  
  try {
    const player = await prisma.player.findFirst({
      where: { name: masterPlayerName },
      include: {
        alliance: true,
        townsList: true,
      }
    });

    if (!player) {
      return NextResponse.json({ error: 'Master player not found in database' }, { status: 404 });
    }

    // Get recent conquers (gained)
    const recentConquers = await prisma.conquest.findMany({
      where: { newPlayerId: player.id },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    // Get recent losses
    const recentLosses = await prisma.conquest.findMany({
      where: { oldPlayerId: player.id },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    return NextResponse.json({
      player,
      recentConquers,
      recentLosses
    });
  } catch (error) {
    console.error('Error fetching master player:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
