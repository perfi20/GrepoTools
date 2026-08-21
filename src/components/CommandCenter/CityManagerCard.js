'use client';
import React, { useState, useEffect } from 'react';
import DemolitionSimulator from './DemolitionSimulator';
import { Save, AlertTriangle } from 'lucide-react';

export default function CityManagerCard({ townId, initialData }) {
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!initialData && townId) {
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
    setSuccessMsg('');
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
      
      setSuccessMsg('Configuration saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
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
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/90 text-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-5 gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{data.name}</h2>
          <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {data.id} • Points: {data.points?.toLocaleString()}</div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn btn-primary text-xs py-2 px-5"
        >
          <Save size={15} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 text-rose-300 text-xs p-3 rounded-xl mb-4 border border-rose-500/30 flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 text-emerald-300 text-xs p-3 rounded-xl mb-4 border border-emerald-500/30 font-mono">
          ✓ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Configs */}
        <div className="space-y-6 flex flex-col gap-5">
          {/* Specialization */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-300">City Specialization</label>
            <select 
              value={data.specialization || "NONE"} 
              onChange={e => handleChange('specialization', e.target.value)}
              className="input-field text-sm font-semibold"
            >
              {specs.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            {showWallWarning && (
              <div className="mt-2 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>Warning: Offensive towns typically keep Wall at Level 0 to reclaim farm population.</span>
              </div>
            )}
          </div>

          {/* Researches */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <h3 className="font-semibold text-xs text-slate-300 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">Researches & Special Buildings</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input type="checkbox" checked={data.plowResearched || false} onChange={e => handleChange('plowResearched', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-primary w-4 h-4" />
                <span>Plow (+200 Pop)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input type="checkbox" checked={data.bunksResearched || false} onChange={e => handleChange('bunksResearched', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-primary w-4 h-4" />
                <span>Bunks (+6 TS Cap)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input type="checkbox" checked={data.cartographyResearched || false} onChange={e => handleChange('cartographyResearched', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-primary w-4 h-4" />
                <span>Cartography (+10% Spd)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input type="checkbox" checked={data.mathResearched || false} onChange={e => handleChange('mathResearched', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-primary w-4 h-4" />
                <span>Mathematics</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white mt-1">
                <input type="checkbox" checked={data.hasThermalBaths || false} onChange={e => handleChange('hasThermalBaths', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-primary w-4 h-4" />
                <span className="text-primary font-medium">Thermal Baths (+10% Pop)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white mt-1">
                <input type="checkbox" checked={data.hasLighthouse || false} onChange={e => handleChange('hasLighthouse', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-primary w-4 h-4" />
                <span className="text-primary font-medium">Lighthouse (+15% Spd)</span>
              </label>
            </div>
          </div>
          
          {/* Current Building Levels Input */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <h3 className="font-semibold text-xs text-slate-300 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">Current Building Levels</h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-xs">
              {['main', 'farm', 'barracks', 'docks', 'wall', 'temple', 'lumber', 'stoner', 'ironer', 'market', 'academy'].map(bId => (
                <div key={bId} className="flex justify-between items-center bg-slate-900/60 p-1.5 px-2.5 rounded-lg border border-slate-800">
                  <span className="capitalize text-slate-300 font-medium">{bId}</span>
                  <input 
                    type="number" 
                    min="0"
                    max="45"
                    value={data[`${bId}Level`] || 0}
                    onChange={e => handleBuildingChange(bId, e.target.value)}
                    className="input-field w-14 py-0.5 px-1 text-center font-mono text-xs font-bold"
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
