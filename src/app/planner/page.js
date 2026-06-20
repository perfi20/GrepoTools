'use client';
import { useState, useEffect } from 'react';
import CityManagerCard from '@/components/CommandCenter/CityManagerCard';

export default function PlannerPage() {
  const [units, setUnits] = useState([]);
  const [counts, setCounts] = useState({});
  const [maxPopulation, setMaxPopulation] = useState(3000);
  const [loadingUnits, setLoadingUnits] = useState(true);

  const [towns, setTowns] = useState([]);
  const [selectedTownId, setSelectedTownId] = useState('');
  const [loadingTowns, setLoadingTowns] = useState(true);

  // Troop validation states
  const [transportCapacity, setTransportCapacity] = useState(0);

  useEffect(() => {
    // Fetch units
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const sorted = data.units.sort((a, b) => (a.population || 0) - (b.population || 0));
          setUnits(sorted);
        }
        setLoadingUnits(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingUnits(false);
      });

    // Fetch player towns
    fetch('/api/master-player')
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.player?.id) {
          return fetch(`/api/towns?playerId=${data.player.id}`);
        }
        throw new Error('No master player');
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTowns(data);
          if (data.length > 0) setSelectedTownId(data[0].id.toString());
        }
        setLoadingTowns(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingTowns(false);
      });
  }, []);

  const handleCountChange = (unitId, val) => {
    const num = parseInt(val, 10);
    setCounts(prev => ({
      ...prev,
      [unitId]: isNaN(num) || num < 0 ? 0 : num
    }));
  };

  const selectedTown = towns.find(t => t.id.toString() === selectedTownId);

  // Army Math
  const usedPopulation = units.reduce((sum, u) => {
    return sum + (counts[u.id] || 0) * (u.population || 0);
  }, 0);

  const remainingPopulation = maxPopulation - usedPopulation;
  const totalAttack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.attack || 0), 0);
  const totalDefHack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_hack || 0), 0);
  const totalDefPierce = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_pierce || 0), 0);
  const totalDefDistance = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_distance || 0), 0);

  // Transport Capacity Logic
  const bunksResearched = selectedTown?.bunksResearched || false;
  const TS_CAPACITY = bunksResearched ? 26 : 20;
  const FTS_CAPACITY = bunksResearched ? 16 : 10;

  // Assuming transport ship id is 'transport' and fast transport is 'fast_transport' 
  // You might need to adjust these IDs based on actual data
  const tsCount = units.find(u => u.name.toLowerCase().includes('transport ship')) ? counts[units.find(u => u.name.toLowerCase().includes('transport ship'))?.id] || 0 : 0;
  const ftsCount = units.find(u => u.name.toLowerCase().includes('fast transport ship')) ? counts[units.find(u => u.name.toLowerCase().includes('fast transport ship'))?.id] || 0 : 0;

  const currentTransportCapacity = (tsCount * TS_CAPACITY) + (ftsCount * FTS_CAPACITY);
  
  // Calculate land troops population to see if transports are enough
  const landTroopsPopulation = units.filter(u => u.is_naval === false && u.flying !== true).reduce((sum, u) => {
    return sum + (counts[u.id] || 0) * (u.population || 0);
  }, 0);

  const transportDeficit = landTroopsPopulation - currentTransportCapacity;

  return (
    <div className="grid gap-6" style={{ marginTop: '2rem' }}>
      <div className="glass-panel text-center mb-4">
        <h1 className="gradient-text text-3xl font-bold">Empire Command & Planner</h1>
        <p className="text-secondary">Optimize city builds, calculate demolition populations, and plan nukes.</p>
      </div>

      {loadingTowns ? (
        <div className="glass-panel text-center"><p className="animate-pulse">Loading Empire Data...</p></div>
      ) : towns.length > 0 ? (
        <>
          {/* Town Selector */}
          <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
            <label className="text-slate-300 font-semibold">Select Town:</label>
            <select 
              className="bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded w-64"
              value={selectedTownId}
              onChange={e => setSelectedTownId(e.target.value)}
            >
              {towns.map(t => (
                <option key={t.id} value={t.id}>{t.name} (ID: {t.id})</option>
              ))}
            </select>
          </div>

          {/* City Manager / Demolition Simulator */}
          {selectedTown && (
            <CityManagerCard key={selectedTown.id} townId={selectedTown.id} initialData={selectedTown} />
          )}
        </>
      ) : (
        <div className="glass-panel text-center text-amber-400">
          No towns found for your master player. Check your intel integration.
        </div>
      )}
      
      {/* Army Planner section */}
      {loadingUnits ? (
        <div className="glass-panel text-center"><p>Loading units...</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel lg:col-span-2">
            <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
              <h2 className="text-xl font-bold text-slate-200">Army Composer</h2>
              <div className="flex items-center gap-4">
                <label className="text-sm text-secondary">Farm Cap:</label>
                <input 
                  type="number" 
                  className="bg-slate-900 border border-slate-700 rounded p-1 w-24 text-center text-slate-100" 
                  value={maxPopulation} 
                  onChange={e => setMaxPopulation(parseInt(e.target.value, 10) || 0)} 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {units.filter(u => u.population > 0).map(u => (
                <div key={u.id} className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 text-center flex flex-col justify-between">
                  <div>
                    <div className="font-semibold text-slate-300 mb-1 leading-tight">{u.name}</div>
                    <div className="text-xs text-secondary mb-3">Pop: {u.population}</div>
                  </div>
                  <input 
                    type="number"
                    className="bg-slate-900 border border-slate-700 rounded p-1 w-full text-center text-accent focus:ring-accent"
                    min="0"
                    value={counts[u.id] || ''}
                    placeholder="0"
                    onChange={e => handleCountChange(u.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Overview Panel */}
          <div className="glass-panel flex flex-col gap-4 sticky top-6 self-start">
            <h2 className="text-xl font-bold text-slate-200 border-b border-slate-700 pb-2">Army Overview</h2>
            
            <div className="bg-slate-950/60 p-4 rounded-lg text-center">
              <div className="text-sm text-secondary uppercase tracking-wider mb-1">Farm Space</div>
              <div className={`text-3xl font-mono font-bold ${remainingPopulation < 0 ? 'text-red-500' : 'text-green-400'}`}>
                {usedPopulation} <span className="text-lg text-slate-500">/ {maxPopulation}</span>
              </div>
              <div className="text-xs mt-2 text-slate-400">
                {remainingPopulation < 0 ? `${Math.abs(remainingPopulation)} Over Limit` : `${remainingPopulation} Available`}
              </div>
            </div>

            <div className={`bg-slate-950/60 p-4 rounded-lg border ${transportDeficit > 0 ? 'border-red-500/50' : 'border-green-500/50'}`}>
              <div className="text-sm text-secondary uppercase tracking-wider mb-2 text-center">Transport Capacity</div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-slate-400">Land Troops:</span>
                <span className="font-mono text-slate-200">{landTroopsPopulation} pop</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-2 border-b border-slate-800 pb-2">
                <span className="text-slate-400">Ship Capacity:</span>
                <span className="font-mono text-slate-200">{currentTransportCapacity} pop</span>
              </div>
              <div className="text-center mt-2 text-xs">
                {transportDeficit > 0 ? (
                  <span className="text-red-400 font-bold flex items-center justify-center gap-1">⚠️ Need {transportDeficit} more capacity!</span>
                ) : (
                  <span className="text-green-400 font-bold">✓ Capacity Sufficient</span>
                )}
              </div>
            </div>

            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 flex flex-col gap-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Offense</span>
                <strong className="text-red-400">{totalAttack.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Def (Blunt)</span>
                <strong className="text-slate-200">{totalDefHack.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Def (Sharp)</span>
                <strong className="text-slate-200">{totalDefPierce.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Def (Distance)</span>
                <strong className="text-slate-200">{totalDefDistance.toLocaleString()}</strong>
              </div>
            </div>
            
            <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded transition-colors mt-2" onClick={() => setCounts({})}>
              Reset Army
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
}
