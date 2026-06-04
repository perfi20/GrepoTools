import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PALETTE = [
  "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", 
  "#ec4899", "#eab308", "#06b6d4", "#84cc16", "#14b8a6"
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('id'); // e.g. "44,45,54"
    if (!ids) {
      return NextResponse.json({ error: "Missing 'id' parameter" }, { status: 400 });
    }

    const oceanIds = ids.split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    if (oceanIds.length === 0) {
      return NextResponse.json({ error: "Invalid 'id' parameter" }, { status: 400 });
    }

    // Determine the bounding box for all requested oceans
    // Ocean NN means X between (N%10)*100 and (N%10)*100+100
    // Actually Ocean 45: X=400..500, Y=500..600? Wait, Grepolis grid:
    // X goes 0-1000. Y goes 0-1000.
    // Ocean X is Math.floor(gridX / 100), Ocean Y is Math.floor(gridY / 100).
    // So Ocean 45 -> X is 4, Y is 5? Or is it X=4, Y=5 -> Ocean 45?
    // Let's assume Ocean ID is represented as XY (e.g. 45 -> X=4, Y=5).
    // Wait, let's verify if standard Grepolis logic is Ocean = X*10 + Y or Y*10 + X.
    // Usually Ocean 45 means X=400-499, Y=500-599. Or X=4, Y=5. Wait, X is horizontal, Y is vertical.
    // If Ocean is 45, the first digit is X, second is Y. So 4 and 5.
    
    // Fetch Top 10 Alliances for coloring
    const dbAlliances = await prisma.alliance.findMany({
      orderBy: { towns: 'desc' },
      take: 10,
      select: { name: true }
    });
    const allianceColors = {};
    dbAlliances.forEach((a, i) => {
      allianceColors[a.name] = PALETTE[i] || "#ffffff";
    });

    const outputIslands = [];
    const outputTowns = [];

    // To optimize the query, we can query all islands and towns matching the ocean criteria.
    // However, since we might request multiple oceans, we can just use an OR query.
    const orConditions = oceanIds.map(o => {
      const xStr = o.toString().padStart(2, '0');
      const oceanX = parseInt(xStr[0], 10);
      const oceanY = parseInt(xStr[1], 10);
      return {
        x: { gte: oceanX * 100, lt: (oceanX + 1) * 100 },
        y: { gte: oceanY * 100, lt: (oceanY + 1) * 100 }
      };
    });

    // Hardcode world border radius to 250 (center 500,500)
    const worldRadiusSq = Math.pow(250, 2);

    const islands = await prisma.island.findMany({
      where: { OR: orConditions },
      select: { id: true, x: true, y: true, availableTowns: true, resourcePlus: true, resourceMinus: true }
    });

    // Also fetch towns in these oceans
    const townOrConditions = oceanIds.map(o => {
      const xStr = o.toString().padStart(2, '0');
      const oceanX = parseInt(xStr[0], 10);
      const oceanY = parseInt(xStr[1], 10);
      return {
        islandX: { gte: oceanX * 100, lt: (oceanX + 1) * 100 },
        islandY: { gte: oceanY * 100, lt: (oceanY + 1) * 100 }
      };
    });

    const towns = await prisma.town.findMany({
      where: { OR: townOrConditions },
      select: {
        id: true, name: true, points: true, islandX: true, islandY: true, islandSlot: true,
        player: {
          select: { name: true, alliance: { select: { name: true } } }
        }
      }
    });

    // Create town lookup
    const townLookup = {};
    for (const t of towns) {
      const key = `${t.islandX},${t.islandY}`;
      if (!townLookup[key]) townLookup[key] = [];
      townLookup[key].push(t);
    }

    for (const island of islands) {
      // Check if island is strictly inside circular world border
      const distSq = Math.pow(island.x - 500, 2) + Math.pow(island.y - 500, 2);
      if (distSq > worldRadiusSq) continue;

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
      if (totalCapacity === 0) continue; // purely decorative

      const isRock = totalCapacity <= 13;
      let islandColor = "#1e293b"; // Default
      if (islandTowns.length > 0) {
        islandColor = "#e2e8f0"; 
        if (dominantAlliance && allianceColors[dominantAlliance]) {
          islandColor = allianceColors[dominantAlliance];
        }
      }

      outputIslands.push({
        id: island.id, x: island.x, y: island.y,
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
          islandX: t.islandX, islandY: t.islandY,
          slot: t.islandSlot,
          name: t.name,
          points: t.points,
          player: t.player ? t.player.name : 'Ghost Town',
          alliance: t.player && t.player.alliance ? t.player.alliance.name : 'None',
        });
      }
    }

    return NextResponse.json({
      type: 'RawMapData',
      islands: outputIslands,
      towns: outputTowns
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });

  } catch (error) {
    console.error("Ocean API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
