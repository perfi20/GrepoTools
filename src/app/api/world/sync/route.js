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

export const dynamic = 'force-dynamic';

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
    const [
      playersRaw, alliancesRaw, townsRaw, islandsRaw,
      pAttRaw, pDefRaw, pAllRaw,
      aAttRaw, aDefRaw, aAllRaw, conquersRaw
    ] = await Promise.all([
      fetchAndDecompress('players.txt.gz'),
      fetchAndDecompress('alliances.txt.gz'),
      fetchAndDecompress('towns.txt.gz'),
      fetchAndDecompress('islands.txt.gz'),
      fetchAndDecompress('player_kills_att.txt.gz'),
      fetchAndDecompress('player_kills_def.txt.gz'),
      fetchAndDecompress('player_kills_all.txt.gz'),
      fetchAndDecompress('alliance_kills_att.txt.gz'),
      fetchAndDecompress('alliance_kills_def.txt.gz'),
      fetchAndDecompress('alliance_kills_all.txt.gz'),
      fetchAndDecompress('conquers.txt.gz')
    ]);

    // Map Kills
    const pAttMap = new Map(pAttRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const pDefMap = new Map(pDefRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const pAllMap = new Map(pAllRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const aAttMap = new Map(aAttRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const aDefMap = new Map(aDefRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const aAllMap = new Map(aAllRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));

    // 1. Process Alliances
    const newAlliances = [];
    const alliancesToUpdate = [];
    const allianceHistory = [];
    const currentAlliances = await prisma.alliance.findMany();
    const allianceMap = new Map(currentAlliances.map(a => [a.id, a]));
    const seenAllianceIds = new Set();

    for (const row of alliancesRaw) {
      const [idStr, name, pointsStr, townsStr, membersStr, rankStr] = row;
      const id = parseInt(idStr);
      
      if (seenAllianceIds.has(id)) continue;
      seenAllianceIds.add(id);

      const points = parseInt(pointsStr);
      const abp = aAttMap.get(id) || 0;
      const dbp = aDefMap.get(id) || 0;
      const allBp = aAllMap.get(id) || 0;
      
      const newData = {
        id, name, points, 
        towns: parseInt(townsStr), 
        members: parseInt(membersStr), 
        rank: parseInt(rankStr),
        abp, dbp, allBp
      };

      const existing = allianceMap.get(id);
      if (!existing) {
        newAlliances.push(newData);
      } else {
        let changed = false;
        if (existing.points !== points || existing.abp !== abp || existing.dbp !== dbp) {
          allianceHistory.push({
            allianceId: id,
            oldPoints: existing.points,
            newPoints: points,
            abpDelta: abp - existing.abp,
            dbpDelta: dbp - existing.dbp,
            allBpDelta: allBp - existing.allBp,
          });
          changed = true;
        }
        if (existing.name !== name || existing.towns !== newData.towns || existing.members !== newData.members || existing.rank !== newData.rank || existing.allBp !== allBp) changed = true;
        
        if (changed) alliancesToUpdate.push(newData);
      }
    }

    // 2. Process Players
    const newPlayers = [];
    const playersToUpdate = [];
    const playerHistory = [];
    const currentPlayers = await prisma.player.findMany();
    const playerMap = new Map(currentPlayers.map(p => [p.id, p]));

    const validAllianceIds = new Set(seenAllianceIds);
    const seenPlayerIds = new Set();

    for (const row of playersRaw) {
      const [idStr, name, allianceIdStr, pointsStr, rankStr, townsStr] = row;
      const id = parseInt(idStr);
      
      if (seenPlayerIds.has(id)) continue;
      seenPlayerIds.add(id);

      const points = parseInt(pointsStr);
      let allianceId = allianceIdStr ? parseInt(allianceIdStr) : null;
      
      if (allianceId && !validAllianceIds.has(allianceId)) {
          allianceId = null;
      }

      const abp = pAttMap.get(id) || 0;
      const dbp = pDefMap.get(id) || 0;
      const allBp = pAllMap.get(id) || 0;

      const newData = {
        id, name, allianceId, points, 
        rank: parseInt(rankStr), 
        towns: parseInt(townsStr),
        abp, dbp, allBp
      };

      const existing = playerMap.get(id);
      if (!existing) {
        newPlayers.push(newData);
      } else {
        let changed = false;
        if (existing.points !== points || existing.abp !== abp || existing.dbp !== dbp) {
          playerHistory.push({
            playerId: id,
            oldPoints: existing.points,
            newPoints: points,
            abpDelta: abp - existing.abp,
            dbpDelta: dbp - existing.dbp,
            allBpDelta: allBp - existing.allBp,
          });
          changed = true;
        }
        if (existing.name !== name || existing.allianceId !== allianceId || existing.rank !== newData.rank || existing.towns !== newData.towns || existing.allBp !== allBp) changed = true;
        
        if (changed) playersToUpdate.push(newData);
      }
    }

    // 3. Process Towns
    const newTowns = [];
    const townsToUpdate = [];
    const townHistory = [];
    const currentTowns = await prisma.town.findMany({ select: { id: true, points: true, playerId: true, name: true } });
    const townMap = new Map(currentTowns.map(t => [t.id, t]));

    const validPlayerIds = new Set(seenPlayerIds);
    const seenTownIds = new Set();

    for (const row of townsRaw) {
      const [idStr, playerIdStr, name, xStr, yStr, slotStr, pointsStr] = row;
      const id = parseInt(idStr);
      
      if (seenTownIds.has(id)) continue;
      seenTownIds.add(id);

      const points = parseInt(pointsStr);
      let playerId = playerIdStr ? parseInt(playerIdStr) : null;
      
      // Ensure referential integrity
      if (playerId && !validPlayerIds.has(playerId)) {
          playerId = null;
      }

      const newData = {
        id,
        playerId,
        name,
        islandX: parseInt(xStr),
        islandY: parseInt(yStr),
        islandSlot: parseInt(slotStr),
        points
      };

      const existing = townMap.get(id);
      if (!existing) {
        newTowns.push(newData);
      } else {
        let changed = false;
        if (existing.points !== points) {
          townHistory.push({
            townId: id,
            oldPoints: existing.points,
            newPoints: points
          });
          changed = true;
        }
        if (existing.playerId !== playerId || existing.name !== name) changed = true;
        
        if (changed) townsToUpdate.push(newData);
      }
    }
    
    // 4. Process Islands
    const populatedSet = new Set();
    // Reconstruct populated towns from seenTowns
    const townList = [...newTowns, ...townsToUpdate, ...currentTowns.filter(t => seenTownIds.has(t.id) && !townsToUpdate.some(u => u.id === t.id))];
    for (const t of townList) {
      if (t.islandX && t.islandY) populatedSet.add(`${t.islandX},${t.islandY}`);
    }

    const currentIslands = await prisma.island.findMany({ select: { id: true, availableTowns: true } });
    const islandMap = new Map(currentIslands.map(i => [i.id, i]));
    const newIslands = [];
    const islandsToUpdate = [];
    const seenIslandIds = new Set();

    for (const row of islandsRaw) {
        const [idStr, xStr, yStr, type, towns, rPlus, rMinus] = row;
        const id = parseInt(idStr);
        const x = parseInt(xStr);
        const y = parseInt(yStr);

        const distSq = Math.pow(x - 500, 2) + Math.pow(y - 500, 2);
        if (distSq > 250 * 250) continue;

        const availableTowns = parseInt(towns);
        if (availableTowns === 0 && !populatedSet.has(`${x},${y}`)) continue;

        seenIslandIds.add(id);
        const newData = {
            id, x, y,
            type: parseInt(type), availableTowns,
            resourcePlus: rPlus, resourceMinus: rMinus
        };

        const existing = islandMap.get(id);
        if (!existing) {
            newIslands.push(newData);
        } else if (existing.availableTowns !== availableTowns) {
            islandsToUpdate.push(newData);
        }
    }

    // 5. Process Conquers
    const newConquers = [];
    const lastSyncEpoch = meta ? Math.floor(meta.lastSync.getTime() / 1000) : 0;
    
    for (const row of conquersRaw) {
      const [tsStr, townIdStr, oldPStr, newPStr, oldAStr, newAStr, pointsStr] = row;
      const timestampSec = parseInt(tsStr);
      if (timestampSec > lastSyncEpoch) {
        newConquers.push({
          townId: parseInt(townIdStr),
          townPoints: parseInt(pointsStr),
          oldPlayerId: oldPStr && oldPStr !== '' ? parseInt(oldPStr) : null,
          newPlayerId: newPStr && newPStr !== '' ? parseInt(newPStr) : null,
          oldAllianceId: oldAStr && oldAStr !== '' ? parseInt(oldAStr) : null,
          newAllianceId: newAStr && newAStr !== '' ? parseInt(newAStr) : null,
          timestamp: new Date(timestampSec * 1000)
        });
      }
    }

    // Execute Database Transactions
    const tx = [];

    // Removals (Towns -> Players -> Alliances -> Islands) to respect foreign keys
    const townsToRemove = currentTowns.filter(t => !seenTownIds.has(t.id)).map(t => t.id);
    const playersToRemove = currentPlayers.filter(p => !seenPlayerIds.has(p.id)).map(p => p.id);
    const alliancesToRemove = currentAlliances.filter(a => !seenAllianceIds.has(a.id)).map(a => a.id);
    const islandsToRemove = currentIslands.filter(i => !seenIslandIds.has(i.id)).map(i => i.id);

    if (townsToRemove.length > 0) tx.push(prisma.town.deleteMany({ where: { id: { in: townsToRemove } } }));
    if (playersToRemove.length > 0) tx.push(prisma.player.deleteMany({ where: { id: { in: playersToRemove } } }));
    if (alliancesToRemove.length > 0) tx.push(prisma.alliance.deleteMany({ where: { id: { in: alliancesToRemove } } }));
    if (islandsToRemove.length > 0) tx.push(prisma.island.deleteMany({ where: { id: { in: islandsToRemove } } }));

    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    // Inserts
    if (newAlliances.length > 0) chunkArray(newAlliances, BATCH_SIZE).forEach(chunk => tx.push(prisma.alliance.createMany({ data: chunk })));
    if (newPlayers.length > 0) chunkArray(newPlayers, BATCH_SIZE).forEach(chunk => tx.push(prisma.player.createMany({ data: chunk })));
    if (newTowns.length > 0) chunkArray(newTowns, BATCH_SIZE).forEach(chunk => tx.push(prisma.town.createMany({ data: chunk })));
    if (newIslands.length > 0) chunkArray(newIslands, BATCH_SIZE).forEach(chunk => tx.push(prisma.island.createMany({ data: chunk })));

    // Updates
    alliancesToUpdate.forEach(u => tx.push(prisma.alliance.update({ where: { id: u.id }, data: u })));
    playersToUpdate.forEach(u => tx.push(prisma.player.update({ where: { id: u.id }, data: u })));
    townsToUpdate.forEach(u => tx.push(prisma.town.update({ where: { id: u.id }, data: u })));
    islandsToUpdate.forEach(u => tx.push(prisma.island.update({ where: { id: u.id }, data: { availableTowns: u.availableTowns } })));

    // History & Conquers
    if (allianceHistory.length > 0) chunkArray(allianceHistory, BATCH_SIZE).forEach(chunk => tx.push(prisma.allianceHistory.createMany({ data: chunk })));
    if (playerHistory.length > 0) chunkArray(playerHistory, BATCH_SIZE).forEach(chunk => tx.push(prisma.playerHistory.createMany({ data: chunk })));
    if (townHistory.length > 0) chunkArray(townHistory, BATCH_SIZE).forEach(chunk => tx.push(prisma.townHistory.createMany({ data: chunk })));
    if (newConquers.length > 0) chunkArray(newConquers, BATCH_SIZE).forEach(chunk => tx.push(prisma.conquest.createMany({ data: chunk })));

    await prisma.$transaction(tx);

    // 5. Purge Vercel CDN Edge Cache for all world map APIs
    try {
      const { revalidateTag } = require('next/cache');
      console.log("Revalidating Next.js cache for /api/world...");
      revalidatePath('/api/world', 'layout');
      revalidateTag('sync-meta', 'max');
      
      console.log("Generating scoreboard and geoJson caches...");
      const { generateScoreboardData } = require('@/lib/scoreboard');
      const scoreboardData = await generateScoreboardData();
      const scoreboardGzip = zlib.gzipSync(JSON.stringify(scoreboardData)).toString('base64');
      
      const geoJsonData = await generateGeoJSON();
      const geoJsonGzip = zlib.gzipSync(JSON.stringify(geoJsonData)).toString('base64');
      
      // Update sync metadata
      await prisma.syncMetadata.upsert({
        where: { id: 1 },
        update: { lastSync: new Date(), scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip },
        create: { id: 1, lastSync: new Date(), scoreboardCache: scoreboardGzip, geoJsonCache: geoJsonGzip }
      });
      console.log("Sync metadata updated, scoreboard & geojson cached, and edge cache purged!");
    } catch (e) {
      console.error("Failed to update metadata or purge cache:", e);
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
