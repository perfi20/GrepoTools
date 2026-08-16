import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import https from 'https';
import zlib from 'zlib';

const CREATE_BATCH_SIZE = 5000;
const UPDATE_BATCH_SIZE = 50000;

async function fetchAndDecompress(server, filename) {
  return new Promise((resolve, reject) => {
    const url = `https://${server}.grepolis.com/data/${filename}`;
    
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
export const maxDuration = 120; // 2 minutes for full sync

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const worldId = (searchParams.get('world') || 'hu119').toLowerCase();
  const force = searchParams.get('force') === 'true';

  try {
    // Ensure World entry exists in DB
    let world = await prisma.world.findUnique({ where: { id: worldId } });
    if (!world) {
      world = await prisma.world.create({
        data: {
          id: worldId,
          name: worldId.toUpperCase(),
          server: worldId,
          speed: 1.0,
          unitSpeed: 1.0,
          worldType: 'siege',
          isActive: true
        }
      });
    }

    const server = world.server || worldId;

    if (world.lastSync && !force) {
      const minutesSinceLastSync = (Date.now() - world.lastSync.getTime()) / (1000 * 60);
      if (minutesSinceLastSync < 20) {
        return NextResponse.json({ 
          success: true, 
          message: `Throttled: World ${worldId} sync ran ${Math.round(minutesSinceLastSync)} minutes ago. Waiting for 20 minutes interval.`,
          skipped: true,
          worldId,
          lastSync: world.lastSync
        });
      }

      // Check Last-Modified headers
      const filesToCheck = [
        'players.txt.gz', 'alliances.txt.gz', 'towns.txt.gz', 'islands.txt.gz',
        'player_kills_att.txt.gz', 'player_kills_def.txt.gz', 'player_kills_all.txt.gz',
        'alliance_kills_att.txt.gz', 'alliance_kills_def.txt.gz', 'alliance_kills_all.txt.gz',
        'conquers.txt.gz'
      ];
      
      const headRequests = filesToCheck.map(filename => 
        fetch(`https://${server}.grepolis.com/data/${filename}`, { method: 'HEAD' })
          .then(res => res.headers.get('last-modified'))
          .catch(() => null)
      );
      
      const lastModifiedHeaders = await Promise.all(headRequests);
      let latestModifiedDate = new Date(0);
      for (const headerStr of lastModifiedHeaders) {
        if (headerStr) {
          const modDate = new Date(headerStr);
          if (modDate > latestModifiedDate) latestModifiedDate = modDate;
        }
      }

      if (latestModifiedDate.getTime() > 0 && world.lastSync >= latestModifiedDate) {
        return NextResponse.json({ 
          success: true, 
          message: `Data is fresh. Latest server update: ${latestModifiedDate.toISOString()}. Last sync: ${world.lastSync.toISOString()}.`,
          skipped: true,
          worldId,
          lastSync: world.lastSync
        });
      }
    }

    // Fetch and decompress all files
    const [
      playersRaw, alliancesRaw, townsRaw, islandsRaw,
      pAttRaw, pDefRaw, pAllRaw,
      aAttRaw, aDefRaw, aAllRaw, conquersRaw
    ] = await Promise.all([
      fetchAndDecompress(server, 'players.txt.gz'),
      fetchAndDecompress(server, 'alliances.txt.gz'),
      fetchAndDecompress(server, 'towns.txt.gz'),
      fetchAndDecompress(server, 'islands.txt.gz'),
      fetchAndDecompress(server, 'player_kills_att.txt.gz'),
      fetchAndDecompress(server, 'player_kills_def.txt.gz'),
      fetchAndDecompress(server, 'player_kills_all.txt.gz'),
      fetchAndDecompress(server, 'alliance_kills_att.txt.gz'),
      fetchAndDecompress(server, 'alliance_kills_def.txt.gz'),
      fetchAndDecompress(server, 'alliance_kills_all.txt.gz'),
      fetchAndDecompress(server, 'conquers.txt.gz')
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
    const currentAlliances = await prisma.alliance.findMany({ where: { worldId } });
    const allianceMap = new Map(currentAlliances.map(a => [a.id, a]));
    const seenAllianceIds = new Set();

    for (const row of alliancesRaw) {
      const [idStr, name, pointsStr, townsStr, membersStr, rankStr] = row;
      const id = parseInt(idStr);
      if (isNaN(id)) continue;
      
      if (seenAllianceIds.has(id)) continue;
      seenAllianceIds.add(id);

      const points = parseInt(pointsStr) || 0;
      const abp = aAttMap.get(id) || 0;
      const dbp = aDefMap.get(id) || 0;
      const allBp = aAllMap.get(id) || 0;
      
      const newData = {
        id, worldId, name, points, 
        towns: parseInt(townsStr) || 0, 
        members: parseInt(membersStr) || 0, 
        rank: parseInt(rankStr) || 0,
        abp, dbp, allBp
      };

      const existing = allianceMap.get(id);
      if (!existing) {
        newAlliances.push(newData);
      } else {
        let changed = false;
        if (existing.points !== points || existing.abp !== abp || existing.dbp !== dbp) {
          allianceHistory.push({
            worldId,
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
    const currentPlayers = await prisma.player.findMany({ where: { worldId } });
    const playerMap = new Map(currentPlayers.map(p => [p.id, p]));

    const validAllianceIds = new Set(seenAllianceIds);
    const seenPlayerIds = new Set();

    for (const row of playersRaw) {
      const [idStr, name, allianceIdStr, pointsStr, rankStr, townsStr] = row;
      const id = parseInt(idStr);
      if (isNaN(id)) continue;
      
      if (seenPlayerIds.has(id)) continue;
      seenPlayerIds.add(id);

      const points = parseInt(pointsStr) || 0;
      let allianceId = allianceIdStr ? parseInt(allianceIdStr) : null;
      if (allianceId && !validAllianceIds.has(allianceId)) allianceId = null;

      const abp = pAttMap.get(id) || 0;
      const dbp = pDefMap.get(id) || 0;
      const allBp = pAllMap.get(id) || 0;

      const newData = {
        id, worldId, name, allianceId, points, 
        rank: parseInt(rankStr) || 0, 
        towns: parseInt(townsStr) || 0,
        abp, dbp, allBp
      };

      const existing = playerMap.get(id);
      if (!existing) {
        newPlayers.push(newData);
      } else {
        let changed = false;
        if (existing.points !== points || existing.abp !== abp || existing.dbp !== dbp) {
          playerHistory.push({
            worldId,
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
    const currentTowns = await prisma.town.findMany({ 
      where: { worldId },
      select: { id: true, points: true, playerId: true, name: true, islandX: true, islandY: true } 
    });
    const townMap = new Map(currentTowns.map(t => [t.id, t]));

    const validPlayerIds = new Set(seenPlayerIds);
    const seenTownIds = new Set();

    for (const row of townsRaw) {
      const [idStr, playerIdStr, name, xStr, yStr, slotStr, pointsStr] = row;
      const id = parseInt(idStr);
      if (isNaN(id)) continue;
      
      if (seenTownIds.has(id)) continue;
      seenTownIds.add(id);

      const points = parseInt(pointsStr) || 0;
      let playerId = playerIdStr ? parseInt(playerIdStr) : null;
      if (playerId && !validPlayerIds.has(playerId)) playerId = null;

      const newData = {
        id,
        worldId,
        playerId,
        name,
        islandX: parseInt(xStr) || 0,
        islandY: parseInt(yStr) || 0,
        islandSlot: parseInt(slotStr) || 0,
        points
      };

      const existing = townMap.get(id);
      if (!existing) {
        newTowns.push(newData);
      } else {
        let changed = false;
        if (existing.points !== points) {
          townHistory.push({
            worldId,
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
    const townList = [...newTowns, ...townsToUpdate, ...currentTowns.filter(t => seenTownIds.has(t.id) && !townsToUpdate.some(u => u.id === t.id))];
    for (const t of townList) {
      if (t.islandX && t.islandY) populatedSet.add(`${t.islandX},${t.islandY}`);
    }

    const currentIslands = await prisma.island.findMany({ where: { worldId }, select: { id: true, availableTowns: true } });
    const islandMap = new Map(currentIslands.map(i => [i.id, i]));
    const newIslands = [];
    const islandsToUpdate = [];
    const seenIslandIds = new Set();

    for (const row of islandsRaw) {
      const [idStr, xStr, yStr, type, towns, rPlus, rMinus] = row;
      const id = parseInt(idStr);
      if (isNaN(id)) continue;

      const x = parseInt(xStr);
      const y = parseInt(yStr);

      const distSq = Math.pow(x - 500, 2) + Math.pow(y - 500, 2);
      if (distSq > 250 * 250) continue;

      const availableTowns = parseInt(towns) || 0;
      if (availableTowns === 0 && !populatedSet.has(`${x},${y}`)) continue;

      seenIslandIds.add(id);
      const newData = {
        id, worldId, x, y,
        type: parseInt(type) || 0, 
        availableTowns,
        resourcePlus: rPlus || '', 
        resourceMinus: rMinus || ''
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
    const latestDbConquest = await prisma.conquest.findFirst({ 
      where: { worldId },
      orderBy: { timestamp: 'desc' } 
    });
    const lastConquestEpoch = latestDbConquest ? Math.floor(latestDbConquest.timestamp.getTime() / 1000) : 0;
    
    for (const row of conquersRaw) {
      const [townIdStr, tsStr, newPStr, oldPStr, newAStr, oldAStr, pointsStr] = row;
      const timestampSec = parseInt(tsStr);
      if (isNaN(timestampSec)) continue;
      
      if (timestampSec > lastConquestEpoch) {
        newConquers.push({
          worldId,
          townId: parseInt(townIdStr) || 0,
          townPoints: parseInt(pointsStr) || 0,
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

    // Removals for this world only
    const townsToRemove = currentTowns.filter(t => !seenTownIds.has(t.id)).map(t => t.id);
    const playersToRemove = currentPlayers.filter(p => !seenPlayerIds.has(p.id)).map(p => p.id);
    const alliancesToRemove = currentAlliances.filter(a => !seenAllianceIds.has(a.id)).map(a => a.id);
    const islandsToRemove = currentIslands.filter(i => !seenIslandIds.has(i.id)).map(i => i.id);

    // 1. Unlink players from alliances that are being deleted
    if (alliancesToRemove.length > 0) {
      tx.push(prisma.player.updateMany({
        where: { worldId, allianceId: { in: alliancesToRemove } },
        data: { allianceId: null }
      }));
    }

    // 2. Unlink towns from players that are being deleted (ghost towns)
    if (playersToRemove.length > 0) {
      tx.push(prisma.town.updateMany({
        where: { worldId, playerId: { in: playersToRemove } },
        data: { playerId: null }
      }));
    }

    // 3. Execute deletions
    if (townsToRemove.length > 0) tx.push(prisma.town.deleteMany({ where: { worldId, id: { in: townsToRemove } } }));
    if (playersToRemove.length > 0) tx.push(prisma.player.deleteMany({ where: { worldId, id: { in: playersToRemove } } }));
    if (alliancesToRemove.length > 0) tx.push(prisma.alliance.deleteMany({ where: { worldId, id: { in: alliancesToRemove } } }));
    if (islandsToRemove.length > 0) tx.push(prisma.island.deleteMany({ where: { worldId, id: { in: islandsToRemove } } }));

    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    // Inserts
    if (newAlliances.length > 0) chunkArray(newAlliances, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.alliance.createMany({ data: chunk })));
    if (newPlayers.length > 0) chunkArray(newPlayers, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.player.createMany({ data: chunk })));
    if (newTowns.length > 0) chunkArray(newTowns, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.town.createMany({ data: chunk })));
    if (newIslands.length > 0) chunkArray(newIslands, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.island.createMany({ data: chunk })));

    // Updates
    if (alliancesToUpdate.length > 0) {
      chunkArray(alliancesToUpdate, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(a => `(${a.id}, '${worldId}', '${a.name.replace(/'/g, "''")}', ${a.points}, ${a.towns}, ${a.members}, ${a.rank}, ${a.abp}, ${a.dbp}, ${a.allBp})`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          UPDATE "Alliance" AS a SET
            "name" = v."name", "points" = v."points", "towns" = v."towns", "members" = v."members", "rank" = v."rank", "abp" = v."abp", "dbp" = v."dbp", "allBp" = v."allBp"
          FROM (VALUES ${values}) AS v("id", "worldId", "name", "points", "towns", "members", "rank", "abp", "dbp", "allBp")
          WHERE a."id" = v."id" AND a."worldId" = v."worldId"
        `));
      });
    }
    
    if (playersToUpdate.length > 0) {
      chunkArray(playersToUpdate, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(p => `(${p.id}, '${worldId}', '${p.name.replace(/'/g, "''")}', ${p.allianceId ? p.allianceId : 'NULL::int'}, ${p.points}, ${p.rank}, ${p.towns}, ${p.abp}, ${p.dbp}, ${p.allBp})`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          UPDATE "Player" AS p SET
            "name" = v."name", "allianceId" = v."allianceId", "points" = v."points", "rank" = v."rank", "towns" = v."towns", "abp" = v."abp", "dbp" = v."dbp", "allBp" = v."allBp"
          FROM (VALUES ${values}) AS v("id", "worldId", "name", "allianceId", "points", "rank", "towns", "abp", "dbp", "allBp")
          WHERE p."id" = v."id" AND p."worldId" = v."worldId"
        `));
      });
    }

    if (townsToUpdate.length > 0) {
      chunkArray(townsToUpdate, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(t => `(${t.id}, '${worldId}', ${t.playerId ? t.playerId : 'NULL::int'}, '${t.name.replace(/'/g, "''")}', ${t.islandX}, ${t.islandY}, ${t.islandSlot}, ${t.points})`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          UPDATE "Town" AS t SET
            "playerId" = v."playerId", "name" = v."name", "islandX" = v."islandX", "islandY" = v."islandY", "islandSlot" = v."islandSlot", "points" = v."points"
          FROM (VALUES ${values}) AS v("id", "worldId", "playerId", "name", "islandX", "islandY", "islandSlot", "points")
          WHERE t."id" = v."id" AND t."worldId" = v."worldId"
        `));
      });
    }

    if (islandsToUpdate.length > 0) {
      chunkArray(islandsToUpdate, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(i => `(${i.id}, '${worldId}', ${i.availableTowns})`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          UPDATE "Island" AS i SET "availableTowns" = v."availableTowns"
          FROM (VALUES ${values}) AS v("id", "worldId", "availableTowns")
          WHERE i."id" = v."id" AND i."worldId" = v."worldId"
        `));
      });
    }

    // History & Conquers
    if (allianceHistory.length > 0) {
      chunkArray(allianceHistory, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(h => `(${h.allianceId}, '${worldId}', ${h.oldPoints}, ${h.newPoints}, ${h.abpDelta}, ${h.dbpDelta}, ${h.allBpDelta}, NOW())`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          INSERT INTO "AllianceHistory" ("allianceId", "worldId", "oldPoints", "newPoints", "abpDelta", "dbpDelta", "allBpDelta", "timestamp")
          VALUES ${values}
        `));
      });
    }
    
    if (playerHistory.length > 0) {
      chunkArray(playerHistory, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(h => `(${h.playerId}, '${worldId}', ${h.oldPoints}, ${h.newPoints}, ${h.abpDelta}, ${h.dbpDelta}, ${h.allBpDelta}, NOW())`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          INSERT INTO "PlayerHistory" ("playerId", "worldId", "oldPoints", "newPoints", "abpDelta", "dbpDelta", "allBpDelta", "timestamp")
          VALUES ${values}
        `));
      });
    }

    if (townHistory.length > 0) {
      chunkArray(townHistory, UPDATE_BATCH_SIZE).forEach(chunk => {
        const values = chunk.map(h => `(${h.townId}, '${worldId}', ${h.oldPoints}, ${h.newPoints}, NOW())`).join(',');
        tx.push(prisma.$executeRawUnsafe(`
          INSERT INTO "TownHistory" ("townId", "worldId", "oldPoints", "newPoints", "timestamp")
          VALUES ${values}
        `));
      });
    }

    if (newConquers.length > 0) chunkArray(newConquers, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.conquest.createMany({ data: chunk })));

    await prisma.$transaction(tx);

    // Update World lastSync
    const syncTime = new Date();
    await prisma.world.update({
      where: { id: worldId },
      data: { lastSync: syncTime }
    });

    // Revalidate Caches
    try {
      revalidatePath('/api/world');
      revalidateTag('sync-meta');
      
      // Async trigger sync-cache
      const baseUrl = request.headers.get('origin') || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(request.url).origin);
      fetch(`${baseUrl}/api/world/sync-cache?world=${worldId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ world: worldId, trigger: 'sync', force: true })
      }).catch(() => {});
    } catch (e) {
      console.warn("Revalidation warning:", e);
    }

    return NextResponse.json({ 
      success: true,
      worldId,
      lastSync: syncTime,
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
    return NextResponse.json({ success: false, worldId, error: error.message }, { status: 500 });
  }
}
