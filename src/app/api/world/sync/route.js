import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import https from 'https';
import zlib from 'zlib';

const SERVER = process.env.GREPOLIS_SERVER || 'hu119';
const BATCH_SIZE = 5000; // Prisma max parameters limit workaround

async function fetchAndDecompress(filename) {
  return new Promise((resolve, reject) => {
    const url = `https://${SERVER}.grepolis.com/data/${filename}`;
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        if (res.statusCode === 404) return resolve([]);
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }

      const gunzip = zlib.createGunzip();
      res.pipe(gunzip);

      let data = '';
      gunzip.on('data', (chunk) => {
        data += chunk.toString('utf-8');
      });

      gunzip.on('end', () => {
        const lines = data.split('\n').filter(l => l.trim().length > 0);
        resolve(lines.map(line => decodeURIComponent(line.replace(/\+/g, ' ')).split(',')));
      });

      gunzip.on('error', reject);
    }).on('error', reject);
  });
}

export async function GET(request) {
  // We can add a secret key check here later for Vercel Cron
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    if (meta) {
      const minutesSinceLastSync = (new Date() - meta.lastSync) / 1000 / 60;
      if (minutesSinceLastSync < 50) {
        return NextResponse.json({ 
          success: true, 
          message: `Data is fresh. Last synced ${Math.round(minutesSinceLastSync)} minutes ago. Next update available in ${Math.round(50 - minutesSinceLastSync)} minutes.`,
          skipped: true,
          lastSync: meta.lastSync
        });
      }
    }
    const [playersRaw, alliancesRaw, townsRaw, islandsRaw] = await Promise.all([
      fetchAndDecompress('players.txt.gz'),
      fetchAndDecompress('alliances.txt.gz'),
      fetchAndDecompress('towns.txt.gz'),
      fetchAndDecompress('islands.txt.gz')
    ]);

    // 1. Process Alliances
    const newAlliances = [];
    const allianceHistory = [];
    
    // Fetch current state to compare
    const currentAlliances = await prisma.alliance.findMany();
    const allianceMap = new Map(currentAlliances.map(a => [a.id, a]));

    for (const row of alliancesRaw) {
      const [idStr, name, pointsStr, townsStr, membersStr, rankStr] = row;
      const id = parseInt(idStr);
      const points = parseInt(pointsStr);
      
      newAlliances.push({
        id,
        name,
        points,
        towns: parseInt(townsStr),
        members: parseInt(membersStr),
        rank: parseInt(rankStr)
      });

      const existing = allianceMap.get(id);
      if (existing && existing.points !== points) {
        allianceHistory.push({
          allianceId: id,
          oldPoints: existing.points,
          newPoints: points,
        });
      }
    }

    // 2. Process Players
    const newPlayers = [];
    const playerHistory = [];
    const currentPlayers = await prisma.player.findMany();
    const playerMap = new Map(currentPlayers.map(p => [p.id, p]));

    const validAllianceIds = new Set(newAlliances.map(a => a.id));

    for (const row of playersRaw) {
      const [idStr, name, allianceIdStr, pointsStr, rankStr, townsStr] = row;
      const id = parseInt(idStr);
      const points = parseInt(pointsStr);
      let allianceId = allianceIdStr ? parseInt(allianceIdStr) : null;
      
      // Ensure referential integrity (Grepolis data dumps can sometimes have orphaned players)
      if (allianceId && !validAllianceIds.has(allianceId)) {
          allianceId = null;
      }

      newPlayers.push({
        id,
        name,
        allianceId,
        points,
        rank: parseInt(rankStr),
        towns: parseInt(townsStr)
      });

      const existing = playerMap.get(id);
      if (existing && existing.points !== points) {
        playerHistory.push({
          playerId: id,
          oldPoints: existing.points,
          newPoints: points
        });
      }
    }

    // 3. Process Towns
    const newTowns = [];
    const townHistory = [];
    // Only fetch ID and points to save memory for towns (can be 50k+)
    const currentTowns = await prisma.town.findMany({ select: { id: true, points: true } });
    const townMap = new Map(currentTowns.map(t => [t.id, t.points]));

    const validPlayerIds = new Set(newPlayers.map(p => p.id));

    for (const row of townsRaw) {
      const [idStr, playerIdStr, name, xStr, yStr, slotStr, pointsStr] = row;
      const id = parseInt(idStr);
      const points = parseInt(pointsStr);
      let playerId = playerIdStr ? parseInt(playerIdStr) : null;
      
      // Ensure referential integrity (Orphaned towns become ghost towns)
      if (playerId && !validPlayerIds.has(playerId)) {
          playerId = null;
      }

      newTowns.push({
        id,
        playerId,
        name,
        islandX: parseInt(xStr),
        islandY: parseInt(yStr),
        islandSlot: parseInt(slotStr),
        points
      });

      const oldPoints = townMap.get(id);
      if (oldPoints !== undefined && oldPoints !== points) {
        townHistory.push({
          townId: id,
          oldPoints: oldPoints,
          newPoints: points
        });
      }
    }
    
    // 4. Process Islands
    // Build a set of inhabited island coordinates to identify true rocks
    const populatedSet = new Set();
    for (const t of newTowns) {
      populatedSet.add(`${t.islandX},${t.islandY}`);
    }

    const newIslands = [];
    for (const row of islandsRaw) {
        const [idStr, xStr, yStr, type, towns, rPlus, rMinus] = row;
        const x = parseInt(xStr);
        const y = parseInt(yStr);

        // Filter 1: Drop islands outside our 250-radius playable world border
        const distSq = Math.pow(x - 500, 2) + Math.pow(y - 500, 2);
        if (distSq > 250 * 250) continue;

        // Filter 2: Drop uncolonizable "True Rocks" (0 capacity and 0 towns)
        const availableTowns = parseInt(towns);
        if (availableTowns === 0 && !populatedSet.has(`${x},${y}`)) continue;

        newIslands.push({
            id: parseInt(idStr),
            x,
            y,
            type: parseInt(type),
            availableTowns,
            resourcePlus: rPlus,
            resourceMinus: rMinus
        });
    }

    // Execute Database Transactions
    // Delete existing base data (fastest way to "upsert" 50k rows in prisma without blowing up parameters)
    // Then createMany new data. 
    await prisma.$transaction([
      prisma.town.deleteMany(),
      prisma.player.deleteMany(),
      prisma.alliance.deleteMany(),
      prisma.island.deleteMany(),
      
      prisma.alliance.createMany({ data: newAlliances }),
      prisma.player.createMany({ data: newPlayers }),
      prisma.town.createMany({ data: newTowns }),
      prisma.island.createMany({ data: newIslands }),
      
      // Insert History Deltas
      ...(allianceHistory.length > 0 ? [prisma.allianceHistory.createMany({ data: allianceHistory })] : []),
      ...(playerHistory.length > 0 ? [prisma.playerHistory.createMany({ data: playerHistory })] : []),
      ...(townHistory.length > 0 ? [prisma.townHistory.createMany({ data: townHistory })] : []),

      prisma.syncMetadata.upsert({
        where: { id: 1 },
        update: { lastSync: new Date() },
        create: { id: 1, lastSync: new Date() }
      })
    ]);

    return NextResponse.json({ 
      success: true,
      lastSync: new Date(),
      stats: {
          alliances: newAlliances.length,
          players: newPlayers.length,
          towns: newTowns.length,
          islands: newIslands.length,
          deltas: {
              alliances: allianceHistory.length,
              players: playerHistory.length,
              towns: townHistory.length
          }
      }
    });

  } catch (error) {
    console.error("World Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
