import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

// Convert Grepolis Grid (0-1000) to Geographic coordinates
const gridToLng = (x) => (x / 1000) * 360 - 180;
const gridToLat = (y) => -((y / 1000) * 180 - 90);

function getOrbitPoint(centerLng, centerLat, radiusDeg, angle) {
  const lat = centerLat + Math.sin(angle) * radiusDeg;
  const lng = centerLng + Math.cos(angle) * radiusDeg / Math.cos(centerLat * Math.PI / 180);
  return [lng, lat];
}

// Note: We are no longer generating literal GeoJSON here to save network bandwidth.
// This function now returns ultra-condensed raw data which the browser will compile.
export async function generateGeoJSON() {
  console.time("GeoJSON Generation");
  // Fetch towns with only required fields to dramatically reduce memory payload
  const towns = await prisma.town.findMany({
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

  // Fetch Top 10 Alliances directly from the alliance table
  const dbAlliances = await prisma.alliance.findMany({
    orderBy: { towns: 'desc' },
    take: 10,
    select: { name: true }
  });
  const topAlliances = dbAlliances.map(a => a.name);
    
  // Pre-assign a specific color palette to the top 10 alliances
  const PALETTE = [
    "#ef4444", // Red
    "#3b82f6", // Blue
    "#22c55e", // Green
    "#a855f7", // Purple
    "#f97316", // Orange
    "#ec4899", // Pink
    "#eab308", // Yellow
    "#06b6d4", // Cyan
    "#84cc16", // Lime
    "#14b8a6"  // Teal
  ];
  
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

  // Hardcode world border radius to 250 (spans from 250 to 750)
  const worldRadius = 250;
  const worldRadiusSq = Math.pow(worldRadius, 2);
  
  // Fetch all islands within the bounding box of the world radius for fast DB query
  const minX = 500 - worldRadius;
  const maxX = 500 + worldRadius;
  const minY = 500 - worldRadius;
  const maxY = 500 + worldRadius;

  const allIslandsInBox = await prisma.island.findMany({
    where: {
      x: { gte: minX, lte: maxX },
      y: { gte: minY, lte: maxY }
    },
    select: {
      id: true, x: true, y: true, availableTowns: true, resourcePlus: true, resourceMinus: true
    }
  });

  // Filter exactly to the circular world border
  const islands = allIslandsInBox.filter(i => {
    const distSq = Math.pow(i.x - 500, 2) + Math.pow(i.y - 500, 2);
    return distSq <= worldRadiusSq;
  });

  const outputIslands = [];
  const outputTowns = [];

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
    const isRock = totalCapacity < 20; 
    const isTrueRock = totalCapacity === 0;

    if (isTrueRock) continue;

    const islandColor = dominantAlliance ? (allianceColors[dominantAlliance] || "#64748b") : "#1e293b";

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

    for (const t of islandTowns) {
      outputTowns.push({
        id: t.id,
        islandX: t.islandX,
        islandY: t.islandY,
        slot: t.islandSlot,
        name: t.name,
        points: t.points,
        player: t.player ? t.player.name : 'Ghost Town',
        alliance: t.player && t.player.alliance ? t.player.alliance.name : 'None',
      });
    }
  }

  console.timeEnd("GeoJSON Generation");
  return { type: 'RawMapData', islands: outputIslands, towns: outputTowns };
}

export const getCachedGeoJSON = unstable_cache(
  async () => {
    return await generateGeoJSON();
  },
  ['world-geojson'],
  { tags: ['world-geojson'] }
);
