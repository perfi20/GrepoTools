"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Convert Grepolis Grid (0-1000) to Geographic coordinates
const gridToLng = (x) => (x / 1000) * 360 - 180;
const gridToLat = (y) => -((y / 1000) * 180 - 90);

function getOrbitPoint(centerLng, centerLat, radiusDeg, angle) {
  const lat = centerLat + Math.sin(angle) * radiusDeg;
  const lng = centerLng + Math.cos(angle) * radiusDeg / Math.cos(centerLat * Math.PI / 180);
  return [lng, lat];
}

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

  // Place Ocean labels uniformly across the ocean grid (e.g. every 20 points) to ensure visibility everywhere
  for (let ox = 0; ox < 10; ox++) {
    for (let oy = 0; oy < 10; oy++) {
      const offsets = [10, 30, 50, 70, 90];
      offsets.forEach(dx => {
        offsets.forEach(dy => {
          features.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [gridToLng(ox * 100 + dx), gridToLat(oy * 100 + dy)]
            },
            properties: { label: `O${ox}${oy}` }
          });
        });
      });
    }
  }

  return { type: "FeatureCollection", features };
}

export default function WorldMap() {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapProcessing, setMapProcessing] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New States
  const [lastSync, setLastSync] = useState(null);
  const [cursorGrid, setCursorGrid] = useState(null);
  const [jumpX, setJumpX] = useState("");
  const [jumpY, setJumpY] = useState("");
  const [customColors, setCustomColors] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const mapRef = useRef();

  const oceanGrid = useMemo(() => generateOceanGrid(), []);

  // Compile the Raw Data into a GeoJSON FeatureCollection instantly in the browser memory
  const data = useMemo(() => {
    if (!rawData || !rawData.islands) return { type: 'FeatureCollection', features: [] };

    const features = [];
    const townsByIsland = {};

    // Group towns by island
    if (rawData.towns) {
      for (const t of rawData.towns) {
        const key = `${t.islandX},${t.islandY}`;
        if (!townsByIsland[key]) townsByIsland[key] = [];
        townsByIsland[key].push(t);
      }
    }

    for (const island of rawData.islands) {
      const islandLng = gridToLng(island.x);
      const islandLat = gridToLat(island.y);

      // Add the Island/Rock feature
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

      const islandTowns = townsByIsland[`${island.x},${island.y}`] || [];
      if (islandTowns.length === 0) {
        // Optimization: Do NOT generate individual empty slots for completely empty islands!
        // This cuts out 90% of the computation and memory footprint!
        continue;
      }

      const townSlotMap = {};
      for (const t of islandTowns) {
        townSlotMap[t.slot] = t;
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

    return { type: 'FeatureCollection', features };
  }, [rawData]);

  useEffect(() => {
    // Fetch directly from the Vercel-optimized API route
    fetch('/api/world/geojson')
      .then(res => {
        const syncHeader = res.headers.get('X-Last-Sync');
        if (syncHeader) setLastSync(new Date(syncHeader));
        return res.json();
      })
      .then(d => {
        setRawData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const islandsData = useMemo(() => {
    if (!data) return null;
    let features = data.features.filter(f => f.properties.renderType === 'island');
    
    // Apply custom colors if present
    if (Object.keys(customColors).length > 0) {
      features = features.map(f => {
        const ally = f.properties.dominantAlliance;
        if (ally && ally !== "None" && customColors[ally]) {
          return {
            ...f,
            properties: { ...f.properties, islandColor: customColors[ally] }
          };
        }
        return f;
      });
    }

    // Sort so empty dark islands render FIRST, colored inhabited islands render ON TOP
    features.sort((a, b) => {
      const aEmpty = a.properties.islandColor === "#1e293b";
      const bEmpty = b.properties.islandColor === "#1e293b";
      if (aEmpty && !bEmpty) return -1;
      if (!aEmpty && bEmpty) return 1;
      return 0;
    });
    return { type: 'FeatureCollection', features };
  }, [data, customColors]);

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

  const searchStats = useMemo(() => {
    if (!townsData || !searchQuery.trim()) return null;
    const towns = townsData.features;
    let totalPoints = 0;
    towns.forEach(t => totalPoints += t.properties.points);
    return {
      count: towns.length,
      points: totalPoints
    };
  }, [townsData, searchQuery]);

  const worldStats = useMemo(() => {
    if (!rawData || !rawData.islands) return null;
    let populatedIslands = 0;
    rawData.islands.forEach(i => {
      if (i.colonizedCount > 0) populatedIslands++;
    });
    const playersSet = new Set();
    if (rawData.towns) {
      rawData.towns.forEach(t => {
        if (t.player && t.player !== 'Ghost Town') playersSet.add(t.player);
      });
    }
    return {
      totalTowns: rawData.towns ? rawData.towns.length : 0,
      totalIslands: rawData.islands.length,
      populatedIslands,
      players: playersSet.size
    };
  }, [rawData]);

  const handleJump = (e) => {
    e.preventDefault();
    if (!jumpX || !jumpY) return;
    const x = parseInt(jumpX);
    const y = parseInt(jumpY);
    if (isNaN(x) || isNaN(y)) return;
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [gridToLng(x), gridToLat(y)],
        zoom: 6,
        duration: 1000
      });
    }
  };

  const handleFitBounds = () => {
    if (!townsData || townsData.features.length === 0 || !mapRef.current) return;
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    townsData.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    minLng -= 0.5; maxLng += 0.5;
    minLat -= 0.5; maxLat += 0.5;
    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]], 
      { padding: 50, duration: 1000 }
    );
  };

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
      </div>

      <div className="flex-1 min-h-[600px] rounded-xl overflow-hidden border border-white/10 relative">
        {(loading || mapProcessing) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0b101e] bg-opacity-90 backdrop-blur-sm transition-opacity duration-500">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-xl font-bold text-white tracking-widest animate-pulse">
                {loading ? "Downloading World Data..." : "Rendering Battle Map..."}
              </div>
            </div>
          </div>
        )}

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 right-4 z-[60] bg-slate-800/90 hover:bg-slate-700/90 backdrop-blur border border-white/10 p-2 rounded-lg text-white shadow-lg transition-all"
        style={{ marginRight: sidebarOpen ? '21rem' : '0' }}
      >
        {sidebarOpen ? '→' : '←'}
      </button>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="absolute top-4 right-4 z-50 w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col gap-6 text-white" style={{ scrollbarWidth: 'none' }}>
          
          {/* Data Status */}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-blue-400">Data Status</h2>
            <div className="text-sm text-gray-300">
              {lastSync ? `Synced: ${lastSync.toLocaleString()}` : "Loading..."}
            </div>
          </div>

          {/* Jump & Tracker */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-blue-400">Navigation</h2>
            <div className="text-sm font-mono text-gray-300 bg-black/30 p-2 rounded">
              Cursor: {cursorGrid ? `${cursorGrid.x}, ${cursorGrid.y}` : "---, ---"}
            </div>
            <form onSubmit={handleJump} className="flex gap-2 mt-1">
              <input type="number" placeholder="X" value={jumpX} onChange={e=>setJumpX(e.target.value)} className="w-16 bg-black/30 border border-white/10 rounded px-2 py-1 text-sm outline-none" />
              <input type="number" placeholder="Y" value={jumpY} onChange={e=>setJumpY(e.target.value)} className="w-16 bg-black/30 border border-white/10 rounded px-2 py-1 text-sm outline-none" />
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 rounded px-2 py-1 text-sm font-bold transition-colors">Jump</button>
            </form>
          </div>

          {/* Search Stats */}
          {searchQuery.trim() && searchStats && (
            <div className="flex flex-col gap-2 bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg">
              <h2 className="text-md font-bold text-blue-400">Search Results</h2>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Matches:</span>
                <span className="font-bold">{searchStats.count.toLocaleString()} towns</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Points:</span>
                <span className="font-bold text-emerald-400">{searchStats.points.toLocaleString()}</span>
              </div>
              <button onClick={handleFitBounds} className="mt-2 w-full bg-blue-600/50 hover:bg-blue-500/50 border border-blue-500 rounded py-1 text-sm font-bold transition-colors">
                Frame on Map
              </button>
            </div>
          )}

          {/* Top 10 Alliances Legend */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-blue-400">Top 10 Alliances</h2>
            <div className="flex flex-col gap-1">
              {rawData && rawData.topAlliances ? rawData.topAlliances.map((ally) => {
                const activeColor = customColors[ally.name] || ally.color;
                return (
                  <div key={ally.name} className="flex items-center justify-between text-sm group hover:bg-white/5 p-1 rounded transition-colors">
                    <span className="truncate pr-2 text-gray-300 font-medium">{ally.name}</span>
                    <input 
                      type="color" 
                      value={activeColor}
                      onChange={(e) => setCustomColors(prev => ({...prev, [ally.name]: e.target.value}))}
                      className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
                    />
                  </div>
                );
              }) : (
                <div className="text-sm text-gray-500 animate-pulse">Loading...</div>
              )}
            </div>
          </div>

          {/* World Stats */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-blue-400">World Overview</h2>
            {worldStats ? (
              <div className="flex flex-col gap-1 text-sm bg-black/20 p-3 rounded-lg border border-white/5">
                <div className="flex justify-between"><span className="text-gray-400">Players:</span><span className="font-bold text-white">{worldStats.players.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Active Towns:</span><span className="font-bold text-white">{worldStats.totalTowns.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Pop. Islands:</span><span className="font-bold text-white">{worldStats.populatedIslands.toLocaleString()} <span className="text-gray-500 font-normal">/ {worldStats.totalIslands.toLocaleString()}</span></span></div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 animate-pulse">Loading...</div>
            )}
          </div>

        </div>
      )}

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
          interactiveLayerIds={["town-points", "islands-points", "rocks-points", "empty-slots-points"]}
          onMouseEnter={(e) => {
            mapRef.current.getCanvas().style.cursor = "pointer";
          }}
          onMouseLeave={() => {
            mapRef.current.getCanvas().style.cursor = "";
            setHoverInfo(null);
          }}
          onMouseMove={(e) => {
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            const gridX = Math.round((lng + 180) / 360 * 1000);
            const gridY = Math.round((90 - lat) / 0.18);
            setCursorGrid({ x: gridX, y: gridY });

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
          onIdle={() => {
            if (!loading) {
              setMapProcessing(false);
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

          {/* Islands Layer */}
          {islandsData && (
            <Source id="islands-source" type="geojson" data={islandsData}>
              <Layer 
                id="islands-points"
                type="circle"
                minzoom={2}
                paint={{
                  "circle-radius": [
                    "interpolate", ["exponential", 2], ["zoom"],
                    2, 3,
                    6, 16,
                    20, 262144
                  ],
                  "circle-color": ["get", "islandColor"],
                  "circle-opacity": 0.8,
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#0f172a"
                }}
              />
            </Source>
          )}

          {/* Rocks Layer */}
          {rocksData && (
            <Source id="rocks-source" type="geojson" data={rocksData}>
              <Layer 
                id="rocks-points"
                type="circle"
                minzoom={2}
                paint={{
                  "circle-radius": [
                    "interpolate", ["exponential", 2], ["zoom"],
                    2, 1,
                    6, 10,
                    20, 163840
                  ],
                  "circle-color": ["get", "islandColor"],
                  "circle-opacity": 0.4,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#0f172a"
                }}
              />
            </Source>
          )}

          {/* Empty Slots Layer (Only visible when zoomed in >= 6) */}
          {emptySlotsData && (
            <Source id="empty-slots-source" type="geojson" data={emptySlotsData}>
              <Layer 
                id="empty-slots-points"
                type="circle"
                minzoom={6}
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
            <Source id="towns-source" type="geojson" data={townsData} cluster={true} clusterMaxZoom={5} clusterRadius={50}>
              {/* Clustered Heatmap/Bubbles */}
              <Layer 
                id="clusters"
                type="circle"
                minzoom={6}
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
                minzoom={6}
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
                minzoom={6}
                filter={["!", ["has", "point_count"]]}
                paint={{
                  "circle-color": searchQuery ? "#ef4444" : "#eab308",
                  "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
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
