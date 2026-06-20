import React, { useState } from 'react';

export default function DummyFinder({ originTownId, durationSeconds, worldSpeed = 2 }) {
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
      const res = await fetch(`/api/snipe/dummy-targets?origin_id=${originTownId}&duration=${durationSeconds}&unit_speed=${unitSpeed}&world_speed=${worldSpeed}`);
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
    <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50 mt-4">
      <h3 className="text-sm font-bold text-slate-200 mb-2">Dummy Target Finder</h3>
      <p className="text-xs text-secondary mb-3">Find a safe target far enough away to execute your {durationSeconds}s cancel delay.</p>
      
      <div className="flex gap-2 mb-3">
        <div className="flex flex-col">
          <label className="text-xs text-slate-400">Unit Speed</label>
          <input 
            type="number" 
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded p-1 w-20 text-center"
            value={unitSpeed}
            onChange={(e) => setUnitSpeed(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-400">World Speed</label>
          <input 
            type="number" 
            step="0.5"
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded p-1 w-20 text-center"
            value={worldSpeed}
            readOnly
          />
        </div>
        <div className="flex flex-col justify-end">
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-1.5 px-3 rounded"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto pr-1 text-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-1 text-slate-400 font-normal">Town</th>
                <th className="py-1 text-slate-400 font-normal text-right">Travel Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                  <td className="py-1.5">{r.name} <span className="text-xs text-slate-500">[{r.islandX},{r.islandY}]</span></td>
                  <td className="py-1.5 text-right font-mono text-accent">{formatTime(r.travelTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {!loading && results.length === 0 && !error && (
        <div className="text-xs text-slate-500 italic">Click search to find dummy targets.</div>
      )}
    </div>
  );
}
