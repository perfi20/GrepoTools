import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Convert Grepolis Grid (0-1000) to Geographic coordinates
const gridToLng = (x) => (x / 1000) * 360 - 180;
const gridToLat = (y) => -((y / 1000) * 180 - 90);

export async function GET() {
  try {
    console.time("GeoJSON Generation");
    // Fetch all playable islands
    const islands = await prisma.island.findMany({
      where: {
        availableTowns: { gt: 0 }
      }
    });

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

    // Create a quick lookup for towns by island coordinates
    const townLookup = {};
    for (const t of towns) {
      const key = `${t.islandX},${t.islandY}`;
      if (!townLookup[key]) townLookup[key] = [];
      townLookup[key].push(t);
    }

    const features = [];
    
    const ORBIT_RADIUS = 0.04; // degrees

    for (const island of islands) {
      const islandLng = gridToLng(island.x);
      const islandLat = gridToLat(island.y);

      const islandTowns = townLookup[`${island.x},${island.y}`] || [];
      const townSlotMap = {};
      for (const t of islandTowns) {
        townSlotMap[t.islandSlot] = t;
      }

      // Add the Island feature
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [islandLng, islandLat]
        },
        properties: {
          renderType: 'island',
          id: island.id,
          x: island.x,
          y: island.y,
          resourcePlus: island.resourcePlus,
          resourceMinus: island.resourceMinus,
          availableTowns: island.availableTowns,
          colonizedCount: islandTowns.length
        }
      });

      // Add Towns and Empty Slots orbiting the island
      // Grepolis islands usually have a max of 20 slots
      const maxSlots = 20; 
      
      // Only generate slots up to availableTowns count
      for (let slot = 0; slot < island.availableTowns; slot++) {
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
