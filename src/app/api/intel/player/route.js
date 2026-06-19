import { NextResponse } from 'next/server';
import { getPlayerIntel } from '@/lib/grepodata';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const world = searchParams.get('world') || process.env.NEXT_PUBLIC_MASTER_WORLD || 'en143';
  let playerId = searchParams.get('player_id');
  const playerName = searchParams.get('player_name');

  if (!playerId && !playerName) {
    return NextResponse.json({ error: 'Missing player_id or player_name' }, { status: 400 });
  }

  try {
    if (!playerId && playerName) {
      const player = await prisma.player.findFirst({
        where: { name: { equals: playerName, mode: 'insensitive' } }
      });
      if (player) {
        playerId = player.id;
      } else {
        return NextResponse.json({ error: 'Player not found in local DB' }, { status: 404 });
      }
    }

    const data = await getPlayerIntel(world, playerId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching player intel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
