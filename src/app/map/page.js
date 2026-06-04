"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import IslandModal from "@/components/IslandModal";

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
  const [rawData, setRawData] = useState({ islands: [], towns: [], topAlliances: [], topPlayers: [] });
  const [loading, setLoading] = useState(true);
  const [mapProcessing, setMapProcessing] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [worldStats, setWorldStats] = useState(null);
  
  // New States
  const [lastSync, setLastSync] = useState(null);
  const [cursorGrid, setCursorGrid] = useState(null);
  const [jumpX, setJumpX] = useState("");
  const [jumpY, setJumpY] = useState("");
  const [customColors, setCustomColors] = useState({});
  const [selectedIsland, setSelectedIsland] = useState(null);
  const [highlightedPlayers, setHighlightedPlayers] = useState({});
  const [highlightedAlliances, setHighlightedAlliances] = useState({});
  const [manualHighlightInput, setManualHighlightInput] = useState("");
  
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
    async function loadData() {
      try {
        // 1. Fetch Meta
        const metaRes = await fetch('/api/world/meta');
        const meta = await metaRes.json();
        
        setRawData(prev => ({
          ...prev,
          topAlliances: meta.topAlliances,
          topPlayers: meta.topPlayers
        }));
        setWorldStats(meta.stats);
        if (meta.lastSync) setLastSync(new Date(meta.lastSync));

        // 2. Define Ocean Batches
        const core = ["44","45","54","55"];
        const inner = [];
        for (let x=3; x<=6; x++) {
          for (let y=3; y<=6; y++) {
            const id = `${x}${y}`;
            if (!core.includes(id)) inner.push(id);
          }
        }
        
        const outer = [];
        for (let x=2; x<=7; x++) {
          for (let y=2; y<=7; y++) {
            const id = `${x}${y}`;
            if (!core.includes(id) && !inner.includes(id)) outer.push(id);
          }
        }

        const fetchOceanBatch = async (ids) => {
          const responses = await Promise.all(ids.map(id => fetch(`/api/world/ocean/${id}`)));
          
          const batchIslands = [];
          const batchTowns = [];

          for (const res of responses) {
            if (res.ok) {
              const data = await res.json();
              if (data.islands) batchIslands.push(...data.islands);
              if (data.towns) batchTowns.push(...data.towns);
            }
          }

          if (batchIslands.length > 0) {
            setRawData(prev => ({
              ...prev,
              islands: [...prev.islands, ...batchIslands],
              towns: [...prev.towns, ...batchTowns]
            }));
          }
        };

        // Fetch Core First (awaited so we can dismiss loading screen)
        await fetchOceanBatch(core);
        setLoading(false);

        // Fetch remaining asynchronously
        await fetchOceanBatch(inner);
        await fetchOceanBatch(outer);

      } catch (error) {
        console.error("Map load error:", error);
        setLoading(false);
      }
    }

    loadData();
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
    
    // Apply highlights
    if (Object.keys(highlightedPlayers).length > 0 || Object.keys(highlightedAlliances).length > 0) {
      towns = towns.map(t => {
        const pName = t.properties.player;
        const aName = t.properties.alliance;
        let hColor = null;
        if (highlightedPlayers[pName]) hColor = highlightedPlayers[pName];
        else if (highlightedAlliances[aName]) hColor = highlightedAlliances[aName];

        if (hColor) {
          return { ...t, properties: { ...t.properties, highlightColor: hColor } };
        }
        return t;
      });
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      towns = towns.filter(f => 
        f.properties.player.toLowerCase().includes(lowerQuery) ||
        f.properties.alliance.toLowerCase().includes(lowerQuery) ||
        f.properties.name.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Sort so highlighted towns render on top
    towns.sort((a, b) => {
      if (a.properties.highlightColor && !b.properties.highlightColor) return 1;
      if (!a.properties.highlightColor && b.properties.highlightColor) return -1;
      return 0;
    });

    return { type: 'FeatureCollection', features: towns };
  }, [data, searchQuery, highlightedPlayers, highlightedAlliances]);

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

  // World Stats comes directly from Meta now


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
    <div style={{ position: 'fixed', top: '73px', left: 0, right: 0, bottom: 0, backgroundColor: '#0b101e', zIndex: 10 }}>

      <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 16, 30, 0.9)', backdropFilter: 'blur(4px)' }}>
            <div className="flex flex-col items-center gap-4">
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', letterSpacing: '2px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                {loading ? "Downloading World Data..." : "Rendering Battle Map..."}
              </div>
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
          onClick={(e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              if (feature.properties.renderType === 'island' || feature.properties.renderType === 'rock') {
                setSelectedIsland({
                  id: feature.properties.id,
                  x: feature.properties.x,
                  y: feature.properties.y,
                  availableTowns: feature.properties.availableTowns,
                  colonizedCount: feature.properties.colonizedCount,
                  resourcePlus: feature.properties.resourcePlus,
                  resourceMinus: feature.properties.resourceMinus
                });
              }
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
                  "circle-color": [
                    "case",
                    ["has", "highlightColor"], ["get", "highlightColor"],
                    searchQuery ? "#ef4444" : "#eab308"
                  ],
                  "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    6, ["case", ["has", "highlightColor"], 5, 3],
                    8, ["case", ["has", "highlightColor"], 12, 8]
                  ],
                  "circle-opacity": 1,
                  "circle-stroke-width": ["case", ["has", "highlightColor"], 2, 1],
                  "circle-stroke-color": ["case", ["has", "highlightColor"], "#ffffff", "#000000"]
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
            >
              <div className="glass-panel" style={{ padding: '1rem', minWidth: '200px' }}>
                {hoverInfo.feature.properties.renderType === 'town' && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{hoverInfo.feature.properties.name}</div>
                    <div className="text-secondary">Player: <span style={{ color: 'white' }}>{hoverInfo.feature.properties.player}</span></div>
                    <div className="text-secondary">Alliance: <span style={{ color: 'white' }}>{hoverInfo.feature.properties.alliance}</span></div>
                    <div style={{ color: '#10b981', fontFamily: 'monospace', marginTop: '0.5rem', fontWeight: 'bold' }}>{hoverInfo.feature.properties.points.toLocaleString()} pts</div>
                  </>
                )}
                {(hoverInfo.feature.properties.renderType === 'island' || hoverInfo.feature.properties.renderType === 'rock') && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {hoverInfo.feature.properties.renderType === 'island' ? 'Island' : 'Rock'} ({hoverInfo.feature.properties.x}, {hoverInfo.feature.properties.y})
                    </div>
                    {hoverInfo.feature.properties.dominantAlliance !== "None" && (
                      <div className="text-secondary">
                        Dominant: <span style={{color: hoverInfo.feature.properties.islandColor, fontWeight: 'bold'}}>{hoverInfo.feature.properties.dominantAlliance}</span>
                      </div>
                    )}
                    {hoverInfo.feature.properties.renderType === 'island' && (
                      <div className="text-secondary">Buff: <span style={{ color: 'white' }}>+{hoverInfo.feature.properties.resourcePlus} / -{hoverInfo.feature.properties.resourceMinus}</span></div>
                    )}
                    <div className="text-secondary">Towns: <span style={{ color: 'white' }}>{hoverInfo.feature.properties.colonizedCount} / {hoverInfo.feature.properties.availableTowns}</span></div>
                  </>
                )}
                {hoverInfo.feature.properties.renderType === 'empty-slot' && (
                  <>
                    <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '1.1rem' }}>Empty Slot</div>
                    <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Ready for colonization</div>
                  </>
                )}
              </div>
            </Popup>
          )}

          {/* Detailed Island Modal */}
          {selectedIsland && (
            <IslandModal 
              islandData={selectedIsland} 
              onClose={() => setSelectedIsland(null)} 
              customColors={customColors}
            />
          )}
        </Map>
      </div>

      {/* LEFT SIDEBAR (General Info & Legend) */}
      <div className="glass-panel flex flex-col gap-4" style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50, width: '320px', maxHeight: 'calc(100% - 2rem)', overflowY: 'auto', scrollbarWidth: 'none' }}>
        
        {/* Header */}
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }} className="gradient-text">
          World Map Viewer
        </h1>

        {/* Data Status */}
        <div className="flex flex-col" style={{ gap: '0.25rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>Data Status</h2>
          <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
            {lastSync ? `Synced: ${lastSync.toLocaleString()}` : "Loading..."}
          </div>
        </div>

        {/* Top 10 Alliances Legend */}
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>Top 10 Alliances</h2>
          <div className="flex flex-col" style={{ gap: '0.25rem' }}>
            {rawData && rawData.topAlliances ? rawData.topAlliances.map((ally) => {
              const activeColor = customColors[ally.name] || ally.color;
              return (
                <div key={ally.name} className="flex items-center justify-between" style={{ fontSize: '0.875rem', padding: '0.25rem', borderRadius: '4px', transition: 'background 0.2s' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '0.5rem' }}>{ally.name}</span>
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => {
                        setHighlightedAlliances(prev => {
                          const next = {...prev};
                          if (next[ally.name]) delete next[ally.name];
                          else next[ally.name] = activeColor;
                          return next;
                        });
                      }}
                      style={{ 
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, 
                        opacity: highlightedAlliances[ally.name] ? 1 : 0.3,
                        filter: highlightedAlliances[ally.name] ? `drop-shadow(0 0 5px ${activeColor})` : 'none'
                      }}
                      title="Highlight all towns on map"
                    >
                      👁️
                    </button>
                    <input 
                      type="color" 
                      value={activeColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomColors(prev => ({...prev, [ally.name]: val}));
                        if (highlightedAlliances[ally.name]) {
                          setHighlightedAlliances(prev => ({...prev, [ally.name]: val}));
                        }
                      }}
                      style={{ width: '20px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="text-secondary text-sm" style={{ animation: 'pulse 2s infinite' }}>Loading...</div>
            )}
          </div>
        </div>

        {/* World Stats */}
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>World Overview</h2>
          {worldStats ? (
            <div className="flex flex-col" style={{ gap: '0.25rem', fontSize: '0.875rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex justify-between"><span className="text-secondary">Players:</span><span style={{ fontWeight: 'bold', color: 'white' }}>{worldStats.players.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-secondary">Active Towns:</span><span style={{ fontWeight: 'bold', color: 'white' }}>{worldStats.totalTowns.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-secondary">Pop. Islands:</span><span style={{ fontWeight: 'bold', color: 'white' }}>{worldStats.populatedIslands.toLocaleString()} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>/ {worldStats.totalIslands.toLocaleString()}</span></span></div>
            </div>
          ) : (
            <div className="text-secondary text-sm" style={{ animation: 'pulse 2s infinite' }}>Loading...</div>
          )}
        </div>

      </div>

      {/* RIGHT SIDEBAR (Search & Navigation) */}
      <div className="glass-panel flex flex-col gap-4" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 50, width: '320px', maxHeight: 'calc(100% - 2rem)', overflowY: 'auto', scrollbarWidth: 'none' }}>
        
        {/* Top 10 Players */}
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>Top 10 Players</h2>
          <div className="flex flex-col" style={{ gap: '0.25rem' }}>
            {rawData && rawData.topPlayers ? rawData.topPlayers.map((player) => {
              const isHighlighted = highlightedPlayers[player.name];
              const highlightColor = isHighlighted || customColors[player.alliance] || '#3b82f6';
              return (
                <div key={player.name} className="flex flex-col" style={{ fontSize: '0.875rem', padding: '0.5rem', borderRadius: '6px', background: isHighlighted ? `rgba(59, 130, 246, 0.1)` : 'rgba(255,255,255,0.03)', border: `1px solid ${isHighlighted ? highlightColor : 'transparent'}`, transition: 'all 0.2s' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
                    <button 
                      onClick={() => {
                        setHighlightedPlayers(prev => {
                          const next = {...prev};
                          if (next[player.name]) delete next[player.name];
                          else next[player.name] = highlightColor;
                          return next;
                        });
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: isHighlighted ? 1 : 0.3 }}
                      title="Highlight player's towns"
                    >
                      👁️
                    </button>
                  </div>
                  <div className="flex justify-between text-secondary" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                    <span>{player.points.toLocaleString()} pts • {player.towns} towns</span>
                    <span style={{ color: customColors[player.alliance] || '#94a3b8' }}>{player.alliance}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-secondary text-sm" style={{ animation: 'pulse 2s infinite' }}>Loading...</div>
            )}
          </div>
        </div>

        {/* Manual Highlighting */}
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>Custom Highlights</h2>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (manualHighlightInput.trim()) {
                setHighlightedPlayers(prev => ({
                  ...prev,
                  [manualHighlightInput.trim()]: '#ef4444' // default red for manual
                }));
                setManualHighlightInput("");
              }
            }}
            className="flex" style={{ gap: '0.5rem' }}
          >
            <input 
              type="text" 
              placeholder="Player Name..." 
              value={manualHighlightInput}
              onChange={e => setManualHighlightInput(e.target.value)}
              className="input-field"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }}>Add</button>
          </form>
          
          {/* Active Manual Highlights */}
          {Object.entries(highlightedPlayers).length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {Object.entries(highlightedPlayers).map(([name, color]) => {
                // Skip if it's already in Top 10 (we show it above)
                const isTop10 = rawData?.topPlayers?.some(p => p.name === name);
                if (isTop10) return null;
                return (
                  <div key={name} className="flex items-center justify-between" style={{ fontSize: '0.875rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}` }}>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>{name}</span>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={color}
                        onChange={(e) => setHighlightedPlayers(prev => ({...prev, [name]: e.target.value}))}
                        style={{ width: '20px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      />
                      <button 
                        onClick={() => setHighlightedPlayers(prev => {
                          const next = {...prev};
                          delete next[name];
                          return next;
                        })}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        title="Remove highlight"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>Search</h2>
          <input 
            type="text" 
            placeholder="Search Alliance, Player, or Town..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Search Stats */}
        {searchQuery.trim() && searchStats && (
          <div className="flex flex-col" style={{ gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Matches:</span>
              <span style={{ fontWeight: 'bold' }}>{searchStats.count.toLocaleString()} towns</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Points:</span>
              <span style={{ fontWeight: 'bold', color: '#10b981' }}>{searchStats.points.toLocaleString()}</span>
            </div>
            <button onClick={handleFitBounds} className="btn" style={{ marginTop: '0.5rem', width: '100%', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid var(--primary)', padding: '0.25rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
              Frame on Map
            </button>
          </div>
        )}

        {/* Jump & Tracker */}
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>Navigation</h2>
          <div style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#cbd5e1', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px' }}>
            Cursor: {cursorGrid ? `${cursorGrid.x}, ${cursorGrid.y}` : "---, ---"}
          </div>
          <form onSubmit={handleJump} className="flex" style={{ gap: '0.5rem', marginTop: '0.25rem' }}>
            <input type="number" placeholder="X" value={jumpX} onChange={e=>setJumpX(e.target.value)} className="input-field" style={{ width: '60px', padding: '0.25rem 0.5rem' }} />
            <input type="number" placeholder="Y" value={jumpY} onChange={e=>setJumpY(e.target.value)} className="input-field" style={{ width: '60px', padding: '0.25rem 0.5rem' }} />
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}>Jump</button>
          </form>
        </div>

      </div>

    </div>
  );
}
