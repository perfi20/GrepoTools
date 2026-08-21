#!/usr/bin/env node

/**
 * Standalone World Sync CLI Script for VPS Cronjobs
 * 
 * Usage:
 *   node scripts/sync.js               # Syncs all active worlds
 *   node scripts/sync.js --all          # Syncs all active worlds
 *   node scripts/sync.js --world=en143 # Syncs only world en143
 *   node scripts/sync.js --force       # Bypasses 20-min throttle check
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');
const zlib = require('zlib');

const prisma = new PrismaClient();

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

async function syncWorld(worldIdInput, { force = false } = {}) {
  const worldId = (worldIdInput || 'hu119').toLowerCase().trim();
  const startTime = Date.now();

  try {
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
        console.log(`[${worldId}] ⏳ Throttled: Sync ran ${Math.round(minutesSinceLastSync)}m ago. Skipping.`);
        return { success: true, skipped: true, worldId };
      }
    }

    console.log(`[${worldId}] 🌐 Downloading feeds from ${server}.grepolis.com...`);

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

    const pAttMap = new Map(pAttRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const pDefMap = new Map(pDefRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const pAllMap = new Map(pAllRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const aAttMap = new Map(aAttRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const aDefMap = new Map(aDefRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));
    const aAllMap = new Map(aAllRaw.map(row => [parseInt(row[1]), parseInt(row[2])]));

    // Alliances
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

    // Players
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

    // Towns
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
        id, worldId, playerId, name,
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

    // Islands
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

    // Conquers
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

    // Database Transactions
    const tx = [];

    const townsToRemove = currentTowns.filter(t => !seenTownIds.has(t.id)).map(t => t.id);
    const playersToRemove = currentPlayers.filter(p => !seenPlayerIds.has(p.id)).map(p => p.id);
    const alliancesToRemove = currentAlliances.filter(a => !seenAllianceIds.has(a.id)).map(a => a.id);
    const islandsToRemove = currentIslands.filter(i => !seenIslandIds.has(i.id)).map(i => i.id);

    if (alliancesToRemove.length > 0) {
      tx.push(prisma.player.updateMany({
        where: { worldId, allianceId: { in: alliancesToRemove } },
        data: { allianceId: null }
      }));
    }

    if (playersToRemove.length > 0) {
      tx.push(prisma.town.updateMany({
        where: { worldId, playerId: { in: playersToRemove } },
        data: { playerId: null }
      }));
    }

    if (townsToRemove.length > 0) tx.push(prisma.town.deleteMany({ where: { worldId, id: { in: townsToRemove } } }));
    if (playersToRemove.length > 0) tx.push(prisma.player.deleteMany({ where: { worldId, id: { in: playersToRemove } } }));
    if (alliancesToRemove.length > 0) tx.push(prisma.alliance.deleteMany({ where: { worldId, id: { in: alliancesToRemove } } }));
    if (islandsToRemove.length > 0) tx.push(prisma.island.deleteMany({ where: { worldId, id: { in: islandsToRemove } } }));

    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    if (newAlliances.length > 0) chunkArray(newAlliances, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.alliance.createMany({ data: chunk })));
    if (newPlayers.length > 0) chunkArray(newPlayers, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.player.createMany({ data: chunk })));
    if (newTowns.length > 0) chunkArray(newTowns, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.town.createMany({ data: chunk })));
    if (newIslands.length > 0) chunkArray(newIslands, CREATE_BATCH_SIZE).forEach(chunk => tx.push(prisma.island.createMany({ data: chunk })));

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

    console.log(`[${worldId}] 💾 Executing ${tx.length} DB transaction operations...`);
    await prisma.$transaction(tx);

    const syncTime = new Date();
    await prisma.world.update({
      where: { id: worldId },
      data: { lastSync: syncTime }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${worldId}] ✅ Sync finished in ${elapsed}s (+${newPlayers.length} players, +${newTowns.length} towns, +${newConquers.length} conquers).`);

    return { success: true, worldId, lastSync: syncTime };
  } catch (error) {
    console.error(`[${worldId}] ❌ Sync error:`, error);
    return { success: false, worldId, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const worldArg = args.find(a => a.startsWith('--world='));
  const targetWorld = worldArg ? worldArg.split('=')[1].trim().toLowerCase() : null;

  console.log('---------------------------------------------------------');
  console.log(`[GrepoTools CLI Sync] ${new Date().toISOString()}`);
  console.log('---------------------------------------------------------');

  if (targetWorld) {
    console.log(`🎯 Syncing specified world: ${targetWorld} (force: ${force})`);
    const res = await syncWorld(targetWorld, { force });
    await prisma.$disconnect();
    process.exit(res.success ? 0 : 1);
  }

  // Find all active worlds
  const activeWorlds = await prisma.world.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' }
  });

  const worldsToSync = activeWorlds.length > 0 ? activeWorlds : [{ id: 'hu119' }];
  console.log(`🌍 Discovered ${worldsToSync.length} active world(s): [${worldsToSync.map(w => w.id).join(', ')}]`);

  let failures = 0;
  for (const w of worldsToSync) {
    const res = await syncWorld(w.id, { force });
    if (!res.success) failures++;
  }

  console.log('---------------------------------------------------------');
  console.log(`[GrepoTools CLI Sync] All jobs complete. (${worldsToSync.length - failures}/${worldsToSync.length} succeeded)`);
  console.log('---------------------------------------------------------');

  await prisma.$disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('[CLI Sync Fatal]', e);
  await prisma.$disconnect();
  process.exit(1);
});
