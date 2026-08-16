import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const worldId = (searchParams.get('world') || 'hu119').toLowerCase();
  const playerName = searchParams.get('playerName');
  const playerIdStr = searchParams.get('playerId');

  try {
    let whereClause = { worldId };

    if (playerIdStr) {
      const pId = parseInt(playerIdStr, 10);
      if (!isNaN(pId)) whereClause.id = pId;
    } else if (playerName && playerName.trim().length > 0) {
      whereClause.name = { equals: playerName.trim(), mode: 'insensitive' };
    } else {
      // Fallback preference: environment variable or first top player in world
      const envName = process.env.NEXT_PUBLIC_MASTER_PLAYER_NAME;
      if (envName) {
        whereClause.name = { equals: envName, mode: 'insensitive' };
      }
    }

    let player = await prisma.player.findFirst({
      where: whereClause,
      include: {
        alliance: true,
        townsList: {
          orderBy: { points: 'desc' }
        },
      }
    });

    // If player not found by name, fallback to first player in this world
    if (!player) {
      player = await prisma.player.findFirst({
        where: { worldId },
        orderBy: { points: 'desc' },
        include: {
          alliance: true,
          townsList: {
            orderBy: { points: 'desc' }
          },
        }
      });
    }

    if (!player) {
      return NextResponse.json({ 
        player: null, 
        recentConquers: [], 
        recentLosses: [],
        message: 'No players found in database for this world. Please sync world data first.' 
      });
    }

    // Get recent conquers (gained)
    const recentConquers = await prisma.conquest.findMany({
      where: { worldId, newPlayerId: player.id },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    // Get recent losses
    const recentLosses = await prisma.conquest.findMany({
      where: { worldId, oldPlayerId: player.id },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    return NextResponse.json({
      player,
      worldId,
      recentConquers,
      recentLosses
    });
  } catch (error) {
    console.error('Error fetching master player:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
