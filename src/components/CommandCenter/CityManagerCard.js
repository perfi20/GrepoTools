'use client';
import React, { useState, useEffect } from 'react';
import DemolitionSimulator from './DemolitionSimulator';

export default function CityManagerCard({ townId, initialData }) {
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch data if only townId is provided and no initialData
  useEffect(() => {
    if (!initialData && townId) {
      // In a real scenario, you'd fetch the specific town, 
      // but our /api/towns endpoint currently accepts playerId and returns all towns.
      // For this component, we assume initialData is passed from the parent which fetches all towns.
      setLoading(false);
    }
  }, [townId, initialData]);

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleBuildingChange = (buildingId, value) => {
    const val = parseInt(value, 10) || 0;
    setData(prev => ({ ...prev, [`${buildingId}Level`]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/towns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          townId: data.id,
          specialization: data.specialization,
          bunksResearched: data.bunksResearched,
          plowResearched: data.plowResearched,
          cartographyResearched: data.cartographyResearched,
          mathResearched: data.mathResearched,
          hasThermalBaths: data.hasThermalBaths,
          hasTower: data.hasTower,
          hasLighthouse: data.hasLighthouse,
          buildingLevels: {
            mainLevel: data.mainLevel,
            farmLevel: data.farmLevel,
            barracksLevel: data.barracksLevel,
            docksLevel: data.docksLevel,
            wallLevel: data.wallLevel,
            templeLevel: data.templeLevel,
            lumberLevel: data.lumberLevel,
            stonerLevel: data.stonerLevel,
            ironerLevel: data.ironerLevel,
            marketLevel: data.marketLevel,
            academyLevel: data.academyLevel
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save town configuration');
      }
      
      // Optionally show a success toast here
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return <div className="p-4 text-slate-400 animate-pulse">Loading City Data...</div>;

  const specs = ["NONE", "NO_LS", "LO_TS", "ND_BIR", "LD_DEF", "MYTH_MANTICORE", "MYTH_HARPY"];

  // Warning for Wall Level
  const offensiveSpecs = ["NO_LS", "LO_TS", "MYTH_MANTICORE", "MYTH_HARPY"];
  const showWallWarning = offensiveSpecs.includes(data.specialization) && (data.wallLevel || 0) > 0;

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-700/50 bg-slate-900/80 text-slate-200">
      <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-accent">{data.name}</h2>
          <div className="text-sm text-slate-400">ID: {data.id} | Points: {data.points}</div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-accent hover:bg-accent-light text-slate-900 font-bold py-2 px-6 rounded shadow-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 border border-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Configs */}
        <div className="space-y-6">
          {/* Specialization */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">City Specialization</label>
            <select 
              value={data.specialization || "NONE"} 
              onChange={e => handleChange('specialization', e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded p-2"
            >
              {specs.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            {showWallWarning && (
              <div className="mt-2 text-sm text-amber-400 bg-amber-900/20 p-2 rounded border border-amber-700/50">
                ⚠️ Warning: Offensive towns should have Wall Level 0. Downgrading to 0 reclaims population and removes retake disadvantage.
              </div>
            )}
          </div>

          {/* Researches */}
          <div className="bg-slate-950/40 p-4 rounded border border-slate-800">
            <h3 className="font-semibold text-slate-300 mb-3 border-b border-slate-800 pb-2">Researches & Special Buildings</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={data.plowResearched || false} onChange={e => handleChange('plowResearched', e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-accent focus:ring-accent" />
                <span>Plow (+200 Pop)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={data.bunksResearched || false} onChange={e => handleChange('bunksResearched', e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-accent focus:ring-accent" />
                <span>Bunks (+6 TS Cap)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={data.cartographyResearched || false} onChange={e => handleChange('cartographyResearched', e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-accent focus:ring-accent" />
                <span>Cartography (+10% Spd)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={data.mathResearched || false} onChange={e => handleChange('mathResearched', e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-accent focus:ring-accent" />
                <span>Mathematics</span>
              </label>
              <label className="flex items-center space-x-2 mt-2">
                <input type="checkbox" checked={data.hasThermalBaths || false} onChange={e => handleChange('hasThermalBaths', e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-secondary focus:ring-secondary" />
                <span className="text-secondary">Thermal Baths (+10% Pop)</span>
              </label>
              <label className="flex items-center space-x-2 mt-2">
                <input type="checkbox" checked={data.hasLighthouse || false} onChange={e => handleChange('hasLighthouse', e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-secondary focus:ring-secondary" />
                <span className="text-secondary">Lighthouse (+15% Spd)</span>
              </label>
            </div>
          </div>
          
          {/* Current Building Levels Input */}
          <div className="bg-slate-950/40 p-4 rounded border border-slate-800">
            <h3 className="font-semibold text-slate-300 mb-3 border-b border-slate-800 pb-2">Current Building Levels</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {['main', 'farm', 'barracks', 'docks', 'wall', 'temple', 'lumber', 'stoner', 'ironer', 'market', 'academy'].map(bId => (
                <div key={bId} className="flex justify-between items-center">
                  <span className="capitalize text-slate-400">{bId}</span>
                  <input 
                    type="number" 
                    value={data[`${bId}Level`] || 0}
                    onChange={e => handleBuildingChange(bId, e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-slate-100"
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Demolition Simulator */}
        <div>
          <DemolitionSimulator currentLevels={{
            main: data.mainLevel || 0,
            farm: data.farmLevel || 0,
            barracks: data.barracksLevel || 0,
            docks: data.docksLevel || 0,
            wall: data.wallLevel || 0,
            temple: data.templeLevel || 0,
            lumber: data.lumberLevel || 0,
            stoner: data.stonerLevel || 0,
            ironer: data.ironerLevel || 0,
            market: data.marketLevel || 0,
            academy: data.academyLevel || 0
          }} />
        </div>

      </div>
    </div>
  );
}
