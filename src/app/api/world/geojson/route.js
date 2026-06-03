import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // We only select the necessary fields to keep the payload small (50k towns is a lot)
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

    const features = towns.map(town => {
      // Map X, Y to Longitude, Latitude
      // X = 0..999 maps to Longitude = -180..180
      // Y = 0..999 maps to Latitude = 90..-90 (Y usually goes down in games)
      
      const lng = (town.islandX / 1000) * 360 - 180;
      const lat = -((town.islandY / 1000) * 180 - 90);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          id: town.id,
          name: town.name,
          points: town.points,
          player: town.player ? town.player.name : 'Ghost Town',
          alliance: town.player && town.player.alliance ? town.player.alliance.name : 'None',
        }
      };
    });

    return NextResponse.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error("GeoJSON generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
