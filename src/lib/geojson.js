import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import { PALETTE } from '@/lib/constants';

// Convert Grepolis Grid (0-1000) to Geographic coordinates
const gridToLng = (x) => (x / 1000) * 360 - 180;
const gridToLat = (y) => -((y / 1000) * 180 - 90);

function getOrbitPoint(centerLng, centerLat, radiusDeg, angle) {
  const lat = centerLat + Math.sin(angle) * radiusDeg;
  const lng = centerLng + Math.cos(angle) * radiusDeg / Math.cos(centerLat * Math.PI / 180);
  return [lng, lat];
}

// Generates compiled GeoJSON FeatureCollection for a specific world.
export async function generateGeoJSON(worldId = 'hu119') {
  console.time(`GeoJSON Generation [${worldId}]`);
  
  // Fetch towns for this world
  const towns = await prisma.town.findMany({
    where: { worldId },
    select: {
      id: true, name: true, points: true, islandX: true, islandY: true, islandSlot: true,
      player: {
        select: {
          name: true,
          alliance: { select: { name: true } }
        }
      }
    }
  });

  // Fetch Top 10 Alliances directly from the alliance table for this world
  const dbAlliances = await prisma.alliance.findMany({
    where: { worldId },
    orderBy: { towns: 'desc' },
    take: 10,
    select: { name: true }
  });
  const topAlliances = dbAlliances.map(a => a.name);
    
  
  const allianceColors = {};
  topAlliances.forEach((name, i) => {
    allianceColors[name] = PALETTE[i];
  });

  // Create a quick lookup for towns by island coordinates
  const townLookup = {};
  for (const t of towns) {
    const key = `${t.islandX},${t.islandY}`;
    if (!townLookup[key]) townLookup[key] = [];
    townLookup[key].push(t);
  }

  // World border radius 250 (coordinates 250 to 750)
  const worldRadius = 250;
  const worldRadiusSq = Math.pow(worldRadius, 2);
  
  const minX = 500 - worldRadius;
  const maxX = 500 + worldRadius;
  const minY = 500 - worldRadius;
  const maxY = 500 + worldRadius;

  const allIslandsInBox = await prisma.island.findMany({
    where: {
      worldId,
      x: { gte: minX, lte: maxX },
      y: { gte: minY, lte: maxY }
    },
    select: {
      id: true, x: true, y: true, availableTowns: true, resourcePlus: true, resourceMinus: true
    }
  });

  // Filter to the circular world border
  const islands = allIslandsInBox.filter(i => {
    const distSq = Math.pow(i.x - 500, 2) + Math.pow(i.y - 500, 2);
    return distSq <= worldRadiusSq;
  });

  const outputIslands = [];

  for (const island of islands) {
    const islandTowns = townLookup[`${island.x},${island.y}`] || [];
    let dominantAlliance = null;
    let maxTowns = 0;
    const localAllyCounts = {};

    for (const t of islandTowns) {
      const allyName = t.player && t.player.alliance ? t.player.alliance.name : null;
      if (allyName) {
        localAllyCounts[allyName] = (localAllyCounts[allyName] || 0) + 1;
        if (localAllyCounts[allyName] > maxTowns) {
          maxTowns = localAllyCounts[allyName];
          dominantAlliance = allyName;
        }
      }
    }

    const totalCapacity = island.availableTowns + islandTowns.length;
    if (totalCapacity === 0) continue; // Skip purely decorative rocks

    const isRock = totalCapacity <= 13;

    let islandColor = "#1e293b"; // Default empty island color
    if (islandTowns.length > 0) {
      islandColor = "#e2e8f0"; 
      if (dominantAlliance && allianceColors[dominantAlliance]) {
        islandColor = allianceColors[dominantAlliance];
      }
    }

    outputIslands.push({
      id: island.id,
      x: island.x,
      y: island.y,
      type: isRock ? 'rock' : 'island',
      availableTowns: island.availableTowns,
      resourcePlus: island.resourcePlus,
      resourceMinus: island.resourceMinus,
      colonizedCount: islandTowns.length,
      color: islandColor,
      alliance: dominantAlliance || "None"
    });
  }

  const features = [];
  
  for (const island of outputIslands) {
    const islandLng = gridToLng(island.x);
    const islandLat = gridToLat(island.y);

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [islandLng, islandLat] },
      properties: {
        renderType: island.type,
        id: island.id,
        x: island.x,
        y: island.y,
        resourcePlus: island.resourcePlus,
        resourceMinus: island.resourceMinus,
        availableTowns: island.availableTowns,
        colonizedCount: island.colonizedCount,
        islandColor: island.color,
        dominantAlliance: island.alliance
      }
    });

    const townSlotMap = {};
    const islandTownsList = townLookup[`${island.x},${island.y}`] || [];
    if (islandTownsList.length === 0) continue;

    for (const t of islandTownsList) {
      townSlotMap[t.islandSlot] = {
        id: t.id,
        name: t.name,
        points: t.points,
        player: t.player ? t.player.name : 'Ghost Town',
        alliance: t.player && t.player.alliance ? t.player.alliance.name : 'None',
        townColor: (t.player && t.player.alliance && allianceColors[t.player.alliance.name]) ? allianceColors[t.player.alliance.name] : '#94a3b8'
      };
    }

    const isRock = island.type === 'rock';
    const orbitRadius = !isRock ? 0.15 : 0.10;
    
    const maxSlotOnIsland = Math.max(-1, ...Object.keys(townSlotMap).map(Number));
    const loopSlots = Math.max(island.availableTowns, maxSlotOnIsland + 1, 1);

    for (let slot = 0; slot < loopSlots; slot++) {
      const angle = (slot / loopSlots) * Math.PI * 2;
      const [slotLng, slotLat] = getOrbitPoint(islandLng, islandLat, orbitRadius, angle);

      const town = townSlotMap[slot];
      if (town) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [slotLng, slotLat] },
          properties: {
            renderType: 'town',
            id: town.id,
            name: town.name,
            points: town.points,
            player: town.player,
            alliance: town.alliance,
            townColor: town.townColor
          }
        });
      } else if (slot < island.availableTowns) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [slotLng, slotLat] },
          properties: {
            renderType: 'empty-slot',
            islandId: island.id,
            slot: slot
          }
        });
      }
    }
  }

  console.timeEnd(`GeoJSON Generation [${worldId}]`);
  
  return { 
    type: 'FeatureCollection', 
    features
  };
}

export const getCachedGeoJSON = unstable_cache(
  async (worldId = 'hu119') => {
    return await generateGeoJSON(worldId);
  },
  ['world-geojson-by-world'],
  { tags: ['world-geojson'] }
);
