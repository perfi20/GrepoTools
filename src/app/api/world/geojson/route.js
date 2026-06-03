import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Convert Grepolis Grid (0-1000) to Geographic coordinates
const gridToLng = (x) => (x / 1000) * 360 - 180;
const gridToLat = (y) => -((y / 1000) * 180 - 90);

export async function GET() {
  try {
    console.time("GeoJSON Generation");
    // Fetch all towns with player and alliance data
    const towns = await prisma.town.findMany({
      include: {
        player: {
          select: {
            name: true,
            alliance: { select: { name: true } }
          }
        }
      }
    });

    // Calculate global top alliances
    const globalAllianceCounts = {};
    for (const t of towns) {
      const allyName = t.player && t.player.alliance ? t.player.alliance.name : null;
      if (allyName) {
        globalAllianceCounts[allyName] = (globalAllianceCounts[allyName] || 0) + 1;
      }
    }
    
    const topAlliances = Object.keys(globalAllianceCounts)
      .sort((a, b) => globalAllianceCounts[b] - globalAllianceCounts[a])
      .slice(0, 10);
      
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
      }
    });

    // Filter exactly to the circular world border
    const islands = allIslandsInBox.filter(i => {
      const distSq = Math.pow(i.x - 500, 2) + Math.pow(i.y - 500, 2);
      return distSq <= worldRadiusSq;
    });

    const features = [];
    
    const ORBIT_RADIUS = 0.04; // degrees

    for (const island of islands) {
      const islandLng = gridToLng(island.x);
      const islandLat = gridToLat(island.y);

      const islandTowns = townLookup[`${island.x},${island.y}`] || [];
      const townSlotMap = {};
      let dominantAlliance = null;
      let maxTowns = 0;
      const localAllyCounts = {};

      for (const t of islandTowns) {
        townSlotMap[t.islandSlot] = t;
        
        const allyName = t.player && t.player.alliance ? t.player.alliance.name : null;
        if (allyName) {
          localAllyCounts[allyName] = (localAllyCounts[allyName] || 0) + 1;
          if (localAllyCounts[allyName] > maxTowns) {
            maxTowns = localAllyCounts[allyName];
            dominantAlliance = allyName;
          }
        }
      }

      const isRock = island.availableTowns === 0;
      // #64748b (Slate) for minor alliances, #1e293b for empty
      const islandColor = dominantAlliance ? (allianceColors[dominantAlliance] || "#64748b") : "#1e293b";

      // Add the Island/Rock feature
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [islandLng, islandLat]
        },
        properties: {
          renderType: isRock ? 'rock' : 'island',
          id: island.id,
          x: island.x,
          y: island.y,
          resourcePlus: island.resourcePlus,
          resourceMinus: island.resourceMinus,
          availableTowns: island.availableTowns,
          colonizedCount: islandTowns.length,
          islandColor: islandColor,
          dominantAlliance: dominantAlliance || "None"
        }
      });

      // Add Towns and Empty Slots orbiting the island
      // Grepolis islands usually have a max of 20 slots
      const maxSlots = 20; 
      
      const maxSlotOnIsland = Math.max(-1, ...Object.keys(townSlotMap).map(Number));
      const loopSlots = Math.max(island.availableTowns, maxSlotOnIsland + 1);
      
      // Only generate slots up to availableTowns count or highest town slot (to prevent losing towns on rocks)
      for (let slot = 0; slot < loopSlots; slot++) {
        const angle = (slot / maxSlots) * Math.PI * 2;
        const slotLng = islandLng + Math.cos(angle) * ORBIT_RADIUS;
        // Adjust latitude orbit for aspect ratio so it looks circular (roughly depends on projection, 
        // but MapLibre Mercator will stretch it differently at equator vs poles. At lat 0, it's roughly 1:1)
        const slotLat = islandLat + Math.sin(angle) * ORBIT_RADIUS;

        const town = townSlotMap[slot];
        
        if (town) {
          // Add colonized town
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [slotLng, slotLat]
            },
            properties: {
              renderType: 'town',
              id: town.id,
              name: town.name,
              points: town.points,
              player: town.player ? town.player.name : 'Ghost Town',
              alliance: town.player && town.player.alliance ? town.player.alliance.name : 'None',
            }
          });
        } else {
          // Add empty slot
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [slotLng, slotLat]
            },
            properties: {
              renderType: 'empty-slot',
              islandId: island.id,
              slot: slot
            }
          });
        }
      }
    }

    console.timeEnd("GeoJSON Generation");

    return NextResponse.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error("GeoJSON generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
