"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Convert Grepolis Grid (0-1000) to Geographic coordinates
const gridToLng = (x) => (x / 1000) * 360 - 180;
const gridToLat = (y) => -((y / 1000) * 180 - 90);

const MAP_STYLE = {
  version: 8,
  sources: {},
  glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0b101e" }
    }
  ]
};

function generateOceanGrid() {
  const features = [];
  
  for (let i = 0; i <= 10; i++) {
    const coord = i * 100;
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[gridToLng(coord), gridToLat(0)], [gridToLng(coord), gridToLat(1000)]]
      }
    });
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[gridToLng(0), gridToLat(coord)], [gridToLng(1000), gridToLat(coord)]]
      }
    });
  }

  for (let ox = 0; ox < 10; ox++) {
    for (let oy = 0; oy < 10; oy++) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [gridToLng(ox * 100 + 50), gridToLat(oy * 100 + 50)]
        },
        properties: { label: `O${ox}${oy}` }
      });
    }
  }

  return { type: "FeatureCollection", features };
}

export default function WorldMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const mapRef = useRef();

  const oceanGrid = useMemo(() => generateOceanGrid(), []);

  useEffect(() => {
    fetch("/api/world/geojson")
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const islandsData = useMemo(() => {
    if (!data) return null;
    return { 
      type: 'FeatureCollection', 
      features: data.features.filter(f => f.properties.renderType === 'island') 
    };
  }, [data]);

  const rocksData = useMemo(() => {
    if (!data) return null;
    return { 
      type: 'FeatureCollection', 
      features: data.features.filter(f => f.properties.renderType === 'rock') 
    };
  }, [data]);

  const emptySlotsData = useMemo(() => {
    if (!data) return null;
    return { 
      type: 'FeatureCollection', 
      features: data.features.filter(f => f.properties.renderType === 'empty-slot') 
    };
  }, [data]);

  const townsData = useMemo(() => {
    if (!data) return null;
    let towns = data.features.filter(f => f.properties.renderType === 'town');
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      towns = towns.filter(f => 
        f.properties.player.toLowerCase().includes(lowerQuery) ||
        f.properties.alliance.toLowerCase().includes(lowerQuery) ||
        f.properties.name.toLowerCase().includes(lowerQuery)
      );
    }
    
    return { type: 'FeatureCollection', features: towns };
  }, [data, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex gap-4 mb-4">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          World Map Viewer
        </h1>
        <input 
          type="text" 
          placeholder="Search Alliance, Player, or Town..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
        {loading && <span className="text-blue-400 animate-pulse my-auto">Generating interactive grid...</span>}
      </div>

      <div className="flex-1 min-h-[600px] rounded-xl overflow-hidden border border-white/10 relative">
        <Map
          ref={mapRef}
          mapLibre={maplibregl}
          style={{ width: "100%", height: "100%", position: "absolute", left: 0, top: 0 }}
          initialViewState={{
            longitude: 0,
            latitude: 0,
            zoom: 2
          }}
          maxBounds={[
            [gridToLng(250), gridToLat(750)], // South West
            [gridToLng(750), gridToLat(250)]  // North East
          ]}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={["town-points", "islands-polygons", "rocks-polygons", "empty-slots-points"]}
          onMouseEnter={(e) => {
            mapRef.current.getCanvas().style.cursor = "pointer";
          }}
          onMouseLeave={() => {
            mapRef.current.getCanvas().style.cursor = "";
            setHoverInfo(null);
          }}
          onMouseMove={(e) => {
            if (e.features && e.features.length > 0) {
              setHoverInfo({
                feature: e.features[0],
                x: e.point.x,
                y: e.point.y,
                lngLat: e.lngLat
              });
            } else {
              setHoverInfo(null);
            }
          }}
        >
          {/* Ocean Grid Layer */}
          <Source id="ocean-grid-source" type="geojson" data={oceanGrid}>
            <Layer 
              id="ocean-lines" 
              type="line" 
              paint={{
                "line-color": "#1e293b",
                "line-width": 1,
                "line-dasharray": [2, 2]
              }} 
            />
            <Layer 
              id="ocean-labels" 
              type="symbol" 
              layout={{
                "text-field": ["get", "label"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 24,
                "text-anchor": "center"
              }}
              paint={{
                "text-color": "#334155"
              }}
            />
          </Source>

          {/* Islands Layer (Only visible when zoomed in >= 5) */}
          {islandsData && (
            <Source id="islands-source" type="geojson" data={islandsData}>
              <Layer 
                id="islands-polygons"
                type="fill"
                minzoom={4}
                paint={{
                  "fill-color": ["get", "islandColor"],
                  "fill-opacity": 0.8
                }}
              />
              <Layer 
                id="islands-polygons-outline"
                type="line"
                minzoom={4}
                paint={{
                  "line-color": "#0f172a",
                  "line-width": 2
                }}
              />
            </Source>
          )}

          {/* Rocks Layer (Only visible when zoomed in >= 5) */}
          {rocksData && (
            <Source id="rocks-source" type="geojson" data={rocksData}>
              <Layer 
                id="rocks-polygons"
                type="fill"
                minzoom={5}
                paint={{
                  "fill-color": ["get", "islandColor"],
                  "fill-opacity": 0.5
                }}
              />
              <Layer 
                id="rocks-polygons-outline"
                type="line"
                minzoom={5}
                paint={{
                  "line-color": "#0f172a",
                  "line-width": 1
                }}
              />
            </Source>
          )}

          {/* Empty Slots Layer (Only visible when zoomed in >= 5) */}
          {emptySlotsData && (
            <Source id="empty-slots-source" type="geojson" data={emptySlotsData}>
              <Layer 
                id="empty-slots-points"
                type="circle"
                minzoom={5}
                paint={{
                  "circle-radius": 3,
                  "circle-color": "#ffffff",
                  "circle-opacity": 0.3,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-opacity": 0.5
                }}
              />
            </Source>
          )}

          {/* Towns Layer (Always visible, but clustered at low zoom) */}
          {townsData && (
            <Source id="towns-source" type="geojson" data={townsData} cluster={true} clusterMaxZoom={4} clusterRadius={50}>
              {/* Clustered Heatmap/Bubbles */}
              <Layer 
                id="clusters"
                type="circle"
                filter={["has", "point_count"]}
                paint={{
                  "circle-color": [
                    "step",
                    ["get", "point_count"],
                    "#3b82f6", // Blue for small
                    50,
                    "#8b5cf6", // Purple for medium
                    200,
                    "#ec4899"  // Pink for massive
                  ],
                  "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    15,
                    50,
                    20,
                    200,
                    30
                  ],
                  "circle-opacity": 0.8
                }}
              />
              <Layer 
                id="cluster-count"
                type="symbol"
                filter={["has", "point_count"]}
                layout={{
                  "text-field": "{point_count_abbreviated}",
                  "text-font": ["Noto Sans Regular"],
                  "text-size": 12
                }}
                paint={{
                  "text-color": "#ffffff"
                }}
              />

              {/* Unclustered Points (Towns) */}
              <Layer 
                id="town-points"
                type="circle"
                filter={["!", ["has", "point_count"]]}
                paint={{
                  "circle-color": searchQuery ? "#ef4444" : "#eab308",
                  "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    4, 1.5,
                    6, 3,
                    8, 8
                  ],
                  "circle-opacity": 1,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#000000"
                }}
              />
            </Source>
          )}

          {/* Tooltip */}
          {hoverInfo && (
            <Popup
              longitude={hoverInfo.lngLat.lng}
              latitude={hoverInfo.lngLat.lat}
              closeButton={false}
              closeOnClick={false}
              anchor="bottom"
              offset={10}
              className="custom-popup"
            >
              <div className="bg-slate-900 border border-white/10 p-3 rounded shadow-xl text-sm min-w-[200px]">
                {hoverInfo.feature.properties.renderType === 'town' && (
                  <>
                    <div className="font-bold text-white text-base mb-1">{hoverInfo.feature.properties.name}</div>
                    <div className="text-gray-300"><span className="text-gray-500">Player:</span> {hoverInfo.feature.properties.player}</div>
                    <div className="text-gray-300"><span className="text-gray-500">Alliance:</span> {hoverInfo.feature.properties.alliance}</div>
                    <div className="text-emerald-400 font-mono mt-1">{hoverInfo.feature.properties.points.toLocaleString()} pts</div>
                  </>
                )}
                {(hoverInfo.feature.properties.renderType === 'island' || hoverInfo.feature.properties.renderType === 'rock') && (
                  <>
                    <div className="font-bold text-white text-base mb-1">
                      {hoverInfo.feature.properties.renderType === 'island' ? 'Island' : 'Rock'} ({hoverInfo.feature.properties.x}, {hoverInfo.feature.properties.y})
                    </div>
                    {hoverInfo.feature.properties.dominantAlliance !== "None" && (
                      <div className="text-gray-300">
                        <span className="text-gray-500">Dominant:</span> <span style={{color: hoverInfo.feature.properties.islandColor}}>{hoverInfo.feature.properties.dominantAlliance}</span>
                      </div>
                    )}
                    {hoverInfo.feature.properties.renderType === 'island' && (
                      <div className="text-gray-300"><span className="text-gray-500">Buff:</span> +{hoverInfo.feature.properties.resourcePlus} / -{hoverInfo.feature.properties.resourceMinus}</div>
                    )}
                    <div className="text-gray-300"><span className="text-gray-500">Towns:</span> {hoverInfo.feature.properties.colonizedCount} / {hoverInfo.feature.properties.availableTowns}</div>
                  </>
                )}
                {hoverInfo.feature.properties.renderType === 'empty-slot' && (
                  <>
                    <div className="font-bold text-emerald-400 text-base">Empty Slot</div>
                    <div className="text-gray-400 text-xs">Ready for colonization</div>
                  </>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
