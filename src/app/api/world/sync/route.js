import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import https from 'https';
import zlib from 'zlib';
import { generateGeoJSON } from '@/lib/geojson';

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
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // We can add a secret key check here later for Vercel Cron
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    if (meta && !force) {
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
    const tx = [
      prisma.town.deleteMany(),
      prisma.player.deleteMany(),
      prisma.alliance.deleteMany(),
      prisma.island.deleteMany(),
    ];

    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    chunkArray(newAlliances, BATCH_SIZE).forEach(chunk => tx.push(prisma.alliance.createMany({ data: chunk })));
    chunkArray(newPlayers, BATCH_SIZE).forEach(chunk => tx.push(prisma.player.createMany({ data: chunk })));
    chunkArray(newTowns, BATCH_SIZE).forEach(chunk => tx.push(prisma.town.createMany({ data: chunk })));
    chunkArray(newIslands, BATCH_SIZE).forEach(chunk => tx.push(prisma.island.createMany({ data: chunk })));

    if (allianceHistory.length > 0) chunkArray(allianceHistory, BATCH_SIZE).forEach(chunk => tx.push(prisma.allianceHistory.createMany({ data: chunk })));
    if (playerHistory.length > 0) chunkArray(playerHistory, BATCH_SIZE).forEach(chunk => tx.push(prisma.playerHistory.createMany({ data: chunk })));
    if (townHistory.length > 0) chunkArray(townHistory, BATCH_SIZE).forEach(chunk => tx.push(prisma.townHistory.createMany({ data: chunk })));

    await prisma.$transaction(tx);

    // 5. Pre-generate and cache the MapLibre GeoJSON payload securely inside the PostgreSQL Database!
    // We heavily compress it using GZIP and Base64 encode it. 
    // This shrinks the 20.2MB payload down to ~1.5MB to bypass Prisma Cloud / tenantManager limits!
    try {
      console.log("Generating GeoJSON...");
      const geojson = await generateGeoJSON();
      const stringified = JSON.stringify(geojson);
      
      console.log(`Compressing ${stringified.length} bytes using GZIP...`);
      const gzippedBuffer = zlib.gzipSync(stringified);
      const base64Gzip = gzippedBuffer.toString('base64');
      
      console.log(`Saving ${base64Gzip.length} bytes to PostgreSQL...`);
      await prisma.syncMetadata.upsert({
        where: { id: 1 },
        update: { lastSync: new Date(), geoJsonCache: base64Gzip },
        create: { id: 1, lastSync: new Date(), geoJsonCache: base64Gzip }
      });
      console.log("GeoJSON successfully saved to Database!");
      revalidatePath('/api/world/geojson'); // Purge Vercel CDN Edge Cache
    } catch (e) {
      console.error("Failed to generate and save GeoJSON:", e);
      // Ensure sync metadata is updated even if GeoJSON fails
      await prisma.syncMetadata.upsert({
        where: { id: 1 },
        update: { lastSync: new Date() },
        create: { id: 1, lastSync: new Date() }
      });
    }

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
