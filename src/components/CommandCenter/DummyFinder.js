import React, { useState } from 'react';
import { Target, Search, ArrowRight, Clock, AlertCircle } from 'lucide-react';

export default function DummyFinder({ originTownId, durationSeconds, worldSpeed = 2, worldId = 'hu119' }) {
  const [unitSpeed, setUnitSpeed] = useState(13); // Default light ship speed roughly
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!originTownId) {
      setError('Origin town ID is required (select a valid town for your group).');
      return;
    }
    if (!durationSeconds || durationSeconds <= 0) {
      setError('Duration must be greater than 0.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/snipe/dummy-targets?world=${worldId}&origin_id=${originTownId}&duration=${durationSeconds}&unit_speed=${unitSpeed}&world_speed=${worldSpeed}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch dummy targets');
      
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
          <Target size={15} className="text-primary" /> Dummy Target Finder
        </h3>
        <span className="text-xs font-mono text-slate-400">Min Travel: {durationSeconds}s</span>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Find a ghost town or neutral target far enough away to execute your {Math.ceil(durationSeconds / 60)} min recall timer.
      </p>
      
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">Unit Speed</label>
          <input 
            type="number" 
            className="input-field py-1 px-2 w-24 text-center font-mono text-xs"
            value={unitSpeed}
            onChange={(e) => setUnitSpeed(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">World Speed</label>
          <input 
            type="number" 
            step="0.5"
            className="input-field py-1 px-2 w-24 text-center font-mono text-xs"
            value={worldSpeed}
            disabled
          />
        </div>
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="btn btn-primary text-xs py-1 px-4 h-[30px]"
        >
          <Search size={13} /> {loading ? 'Searching...' : 'Find Safe Targets'}
        </button>
      </div>

      {error && (
        <div className="p-2.5 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {results.map((target) => (
            <div 
              key={target.id} 
              className="flex justify-between items-center bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-xs hover:border-slate-700"
            >
              <div>
                <span className="font-bold text-slate-200">{target.name}</span>
                <span className="text-slate-400 font-mono ml-2">
                  ({target.islandX}, {target.islandY}) • {target.playerName}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-emerald-400 font-semibold">
                <Clock size={12} />
                <span>{formatTime(target.travelTime)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
