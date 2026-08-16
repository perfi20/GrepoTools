'use client';
import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, CheckCircle2, Shield, Swords, Sparkles, Building2 } from 'lucide-react';
import DemolitionSimulator from './DemolitionSimulator';
import { useApp } from '@/context/AppContext';

export default function CityManagerCard({ townId, initialData }) {
  const { activeWorldId } = useApp();
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleBuildingChange = (buildingId, value) => {
    const val = parseInt(value, 10) || 0;
    setData(prev => ({ ...prev, [`${buildingId}Level`]: val }));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/towns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          townId: data.id,
          worldId: data.worldId || activeWorldId,
          specialization: data.specialization || 'NONE',
          bunksResearched: Boolean(data.bunksResearched),
          plowResearched: Boolean(data.plowResearched),
          cartographyResearched: Boolean(data.cartographyResearched),
          mathResearched: Boolean(data.mathResearched),
          hasThermalBaths: Boolean(data.hasThermalBaths),
          hasTower: Boolean(data.hasTower),
          hasLighthouse: Boolean(data.hasLighthouse),
          buildingLevels: {
            mainLevel: data.mainLevel !== undefined ? data.mainLevel : 20,
            farmLevel: data.farmLevel !== undefined ? data.farmLevel : 45,
            barracksLevel: data.barracksLevel !== undefined ? data.barracksLevel : 20,
            docksLevel: data.docksLevel !== undefined ? data.docksLevel : 20,
            wallLevel: data.wallLevel !== undefined ? data.wallLevel : 0,
            templeLevel: data.templeLevel !== undefined ? data.templeLevel : 5,
            lumberLevel: data.lumberLevel !== undefined ? data.lumberLevel : 25,
            stonerLevel: data.stonerLevel !== undefined ? data.stonerLevel : 25,
            ironerLevel: data.ironerLevel !== undefined ? data.ironerLevel : 25,
            marketLevel: data.marketLevel !== undefined ? data.marketLevel : 10,
            academyLevel: data.academyLevel !== undefined ? data.academyLevel : 30
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save town configuration');
      }

      setSuccessMsg('Town configuration saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm animate-pulse">
        Loading City Tactical Intelligence...
      </div>
    );
  }

  const specs = [
    { id: "NONE", label: "General / Balanced", icon: Building2 },
    { id: "NO_LS", label: "Naval Offense (Light Ships)", icon: Swords },
    { id: "LO_TS", label: "Land Offense (Transport Ships)", icon: Swords },
    { id: "ND_BIR", label: "Naval Defense (Biremes)", icon: Shield },
    { id: "LD_DEF", label: "Land Defense (Hoplite/Sword)", icon: Shield },
    { id: "MYTH_MANTICORE", label: "Mythical (Manticores)", icon: Sparkles },
    { id: "MYTH_HARPY", label: "Mythical (Harpies)", icon: Sparkles }
  ];

  // Tactical wall warning for offense specs
  const offensiveSpecs = ["NO_LS", "LO_TS", "MYTH_MANTICORE", "MYTH_HARPY"];
  const showWallWarning = offensiveSpecs.includes(data.specialization) && (data.wallLevel || 0) > 0;

  return (
    <div className="glass-panel p-6 rounded-2xl bg-slate-900/90 border border-slate-700/80">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-5 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">{data.name}</h2>
            <span className="badge badge-primary">
              ID: {data.id}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">
            Island ({data.islandX}, {data.islandY}) • Points: <strong className="text-amber-400">{data.points?.toLocaleString()}</strong>
          </div>
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

      {successMsg && (
        <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-mono animate-fade-in">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center gap-2 font-mono animate-fade-in">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Specialization & Researches */}
        <div className="space-y-5">
          {/* Specialization Selection */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              City Tactical Specialization
            </label>
            <select 
              value={data.specialization || "NONE"} 
              onChange={e => handleChange('specialization', e.target.value)}
              className="w-full text-sm font-semibold"
            >
              {specs.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            
            {showWallWarning && (
              <div className="mt-3 text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 flex items-start gap-2 animate-fade-in">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tactical Wall Warning:</strong> Offensive towns ideally have Wall Level 0 to avoid defending an enemy siege during retakes and to reclaim valuable population!
                </span>
              </div>
            )}
          </div>

          {/* Researches & Special Buildings */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 border-b border-slate-800 pb-2">
              Researches & Special Buildings
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="checkbox" 
                  checked={data.plowResearched || false} 
                  onChange={e => handleChange('plowResearched', e.target.checked)} 
                />
                <span>Plow (+200 Pop)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="checkbox" 
                  checked={data.bunksResearched || false} 
                  onChange={e => handleChange('bunksResearched', e.target.checked)} 
                />
                <span>Bunks (+6 TS Cap)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="checkbox" 
                  checked={data.cartographyResearched || false} 
                  onChange={e => handleChange('cartographyResearched', e.target.checked)} 
                />
                <span>Cartography (+10% Spd)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="checkbox" 
                  checked={data.mathResearched || false} 
                  onChange={e => handleChange('mathResearched', e.target.checked)} 
                />
                <span>Mathematics</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="checkbox" 
                  checked={data.hasThermalBaths || false} 
                  onChange={e => handleChange('hasThermalBaths', e.target.checked)} 
                />
                <span className="text-emerald-400 font-medium">Thermal Baths (+10% Pop)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="checkbox" 
                  checked={data.hasLighthouse || false} 
                  onChange={e => handleChange('hasLighthouse', e.target.checked)} 
                />
                <span className="text-primary font-medium">Lighthouse (+15% Spd)</span>
              </label>
            </div>
          </div>
          
          {/* Current Building Levels Input */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 border-b border-slate-800 pb-2">
              Building Levels
            </h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
              {['main', 'farm', 'barracks', 'docks', 'wall', 'temple', 'lumber', 'stoner', 'ironer', 'market', 'academy'].map(bId => (
                <div key={bId} className="flex justify-between items-center bg-slate-900/60 p-1.5 px-2.5 rounded-lg border border-slate-800/80">
                  <span className="capitalize text-slate-300 font-medium">{bId}</span>
                  <input 
                    type="number" 
                    min="0"
                    max="45"
                    value={data[`${bId}Level`] !== undefined && data[`${bId}Level`] !== null ? data[`${bId}Level`] : ''}
                    placeholder="0"
                    onChange={e => handleBuildingChange(bId, e.target.value)}
                    className="w-14 bg-slate-950 border border-slate-700/80 rounded py-0.5 text-center font-mono font-bold text-white text-xs"
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
