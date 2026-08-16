'use client';
import React, { useState, useEffect } from 'react';
import CityManagerCard from '@/components/CommandCenter/CityManagerCard';
import { useApp } from '@/context/AppContext';
import { Shield, Swords, Anchor, Users, ArrowRight, Zap, AlertTriangle, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

export default function PlannerPage() {
  const { activeWorldId, activeWorld, activePlayer, loadingPlayer } = useApp();
  const [units, setUnits] = useState([]);
  const [counts, setCounts] = useState({});
  const [maxPopulation, setMaxPopulation] = useState(3000);
  const [loadingUnits, setLoadingUnits] = useState(true);

  const [towns, setTowns] = useState([]);
  const [selectedTownId, setSelectedTownId] = useState('');
  const [loadingTowns, setLoadingTowns] = useState(true);

  // Specialization quick preset
  const PRESETS = {
    NO_LS: { label: 'Naval Offense (Fast Fire Ships)', desc: 'Maximizes Light Ships, Level 1 Wall, Level 0 Barracks', units: { light_ship: 280 } },
    LO_TS: { label: 'Land Offense (Slingers/Hoplites + Fast Transports)', desc: 'Heavy land nuke with fast transport capacity', units: { slinger: 1200, hoplite: 800, fast_transport: 125 } },
    ND_BIR: { label: 'Naval Defense (Bireme Wall)', desc: 'Full Bireme stack for fast port defense', units: { bireme: 320 } },
    LD_DEF: { label: 'Land Defense (Swords/Archers/Hoplites)', desc: 'Balanced defense against blunt, sharp, and distance', units: { swordsman: 900, archer: 900, hoplite: 900 } },
    MYTH_MANTICORE: { label: 'Mythic Offense (Manticore Flying Nuke)', desc: 'Flying island hopping strike force (No transports needed)', units: { manticore: 35 } }
  };

  useEffect(() => {
    // Fetch units
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.units)) {
          const sorted = data.units.sort((a, b) => (a.population || 0) - (b.population || 0));
          setUnits(sorted);
        }
        setLoadingUnits(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingUnits(false);
      });
  }, []);

  // Fetch player towns for active world & player
  useEffect(() => {
    if (!activeWorldId || !activePlayer?.id) {
      setTowns([]);
      setLoadingTowns(false);
      return;
    }

    setLoadingTowns(true);
    fetch(`/api/towns?world=${activeWorldId}&playerId=${activePlayer.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTowns(data);
          if (data.length > 0) setSelectedTownId(data[0].id.toString());
        } else {
          setTowns([]);
        }
        setLoadingTowns(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingTowns(false);
      });
  }, [activeWorldId, activePlayer?.id]);

  const handleCountChange = (unitId, val) => {
    const num = parseInt(val, 10);
    setCounts(prev => ({
      ...prev,
      [unitId]: isNaN(num) || num < 0 ? 0 : num
    }));
  };

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const newCounts = {};
    Object.entries(preset.units).forEach(([k, v]) => {
      const u = units.find(unit => unit.id.toLowerCase().includes(k) || unit.name.toLowerCase().includes(k.replace('_', ' ')));
      if (u) newCounts[u.id] = v;
    });
    setCounts(newCounts);
  };

  const selectedTown = towns.find(t => t.id.toString() === selectedTownId);

  // Army Calculations
  const usedPopulation = units.reduce((sum, u) => {
    return sum + (counts[u.id] || 0) * (u.population || 0);
  }, 0);

  const remainingPopulation = maxPopulation - usedPopulation;
  const totalAttack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.attack || 0), 0);
  const totalDefHack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_hack || 0), 0);
  const totalDefPierce = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_pierce || 0), 0);
  const totalDefDistance = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_distance || 0), 0);

  // Transport Ship Capacity Logic
  const bunksResearched = selectedTown?.bunksResearched || false;
  const TS_CAPACITY = bunksResearched ? 26 : 20;
  const FTS_CAPACITY = bunksResearched ? 16 : 10;

  const tsUnit = units.find(u => u.name.toLowerCase() === 'transport ship' || u.id === 'slow_transport');
  const ftsUnit = units.find(u => u.name.toLowerCase().includes('fast transport') || u.id === 'fast_transport');

  const tsCount = tsUnit ? (counts[tsUnit.id] || 0) : 0;
  const ftsCount = ftsUnit ? (counts[ftsUnit.id] || 0) : 0;

  const currentTransportCapacity = (tsCount * TS_CAPACITY) + (ftsCount * FTS_CAPACITY);
  
  // Calculate land troops population to see if transports are enough
  const landTroopsPopulation = units
    .filter(u => !u.is_naval && !u.flying)
    .reduce((sum, u) => sum + (counts[u.id] || 0) * (u.population || 0), 0);

  const transportDeficit = landTroopsPopulation - currentTransportCapacity;
  const requiredFTS = Math.ceil(landTroopsPopulation / FTS_CAPACITY);
  const requiredTS = Math.ceil(landTroopsPopulation / TS_CAPACITY);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded">
            World: {activeWorld?.name || activeWorldId.toUpperCase()}
          </span>
          {activePlayer && (
            <span className="text-xs font-mono bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded">
              Player: {activePlayer.name}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          <Shield size={28} className="text-primary" /> City Specialization & Army Planner
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Simulate building demolitions, maximize free farm population, and validate transport capacity.
        </p>
      </div>

      {loadingTowns ? (
        <div className="glass-panel text-center py-12">
          <p className="text-slate-400 text-sm animate-pulse">Loading Empire Towns...</p>
        </div>
      ) : towns.length > 0 ? (
        <>
          {/* Town Selector Card */}
          <div className="glass-panel p-4 bg-slate-900/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-300">Select City:</label>
              <select 
                className="input-field max-w-xs font-semibold text-accent"
                value={selectedTownId}
                onChange={e => setSelectedTownId(e.target.value)}
              >
                {towns.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.points?.toLocaleString()} pts • #{t.islandSlot})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Total Empire Cities: <strong className="text-white">{towns.length}</strong>
            </div>
          </div>

          {/* City Manager & Demolition Simulator */}
          {selectedTown && (
            <CityManagerCard 
              key={selectedTown.id} 
              townId={selectedTown.id} 
              initialData={selectedTown} 
            />
          )}

          {/* Army & Transport Capacity Planner */}
          <div className="glass-panel p-6 bg-slate-900/80 rounded-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-800 pb-4 gap-3">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Swords size={20} className="text-accent" /> Troop Composition & Nuke Simulator
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulate ideal troop compositions and check transport ship sufficiency.
                </p>
              </div>

              {/* Specialization Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="btn text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg border border-slate-700"
                    title={p.desc}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Used Population</div>
                <div className={`text-xl font-mono font-bold mt-1 ${remainingPopulation < 0 ? 'text-rose-400' : 'text-white'}`}>
                  {usedPopulation} / {maxPopulation}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Total Attack Power</div>
                <div className="text-xl font-mono font-bold text-amber-400 mt-1">
                  {totalAttack.toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Naval / Transport Cap</div>
                <div className={`text-xl font-mono font-bold mt-1 ${transportDeficit > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {currentTransportCapacity} / {landTroopsPopulation} pop
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Def (H / P / D)</div>
                <div className="text-xs font-mono font-bold text-blue-400 mt-2">
                  {totalDefHack} / {totalDefPierce} / {totalDefDistance}
                </div>
              </div>
            </div>

            {/* Transport Warning Banner */}
            {landTroopsPopulation > 0 && transportDeficit > 0 && (
              <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  <span>
                    <strong>Transport Deficit:</strong> You have {landTroopsPopulation} land troop population, but only {currentTransportCapacity} transport capacity ({transportDeficit} unembarked).
                  </span>
                </div>
                <div className="font-mono text-white">
                  Need ~<strong>{requiredFTS}</strong> Fast Transports (or <strong>{requiredTS}</strong> Slow Transports)
                </div>
              </div>
            )}

            {/* Unit Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {units.map(unit => {
                const count = counts[unit.id] || 0;
                return (
                  <div key={unit.id} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                    <div className="mb-2">
                      <div className="text-xs font-bold text-slate-200 truncate" title={unit.name}>
                        {unit.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Pop: {unit.population} • Att: {unit.attack || 0}
                      </div>
                    </div>

                    <input
                      type="number"
                      min="0"
                      value={count === 0 ? '' : count}
                      placeholder="0"
                      onChange={e => handleCountChange(unit.id, e.target.value)}
                      className="input-field text-center font-mono font-bold text-sm bg-slate-900 py-1"
                    />
                  </div>
                );
              })}
            </div>

          </div>
        </>
      ) : (
        <div className="glass-panel text-center py-12">
          <p className="text-slate-400 text-sm mb-3">No towns found for active player in world {activeWorldId.toUpperCase()}.</p>
          <p className="text-xs text-slate-500">Make sure world data is synchronized or select an active player with towns.</p>
        </div>
      )}
    </div>
  );
}
