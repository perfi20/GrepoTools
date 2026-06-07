'use client';
import { useState, useEffect } from 'react';

export default function PlannerPage() {
  const [units, setUnits] = useState([]);
  const [counts, setCounts] = useState({});
  const [maxPopulation, setMaxPopulation] = useState(3000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Filter out heroes/gods if they are mixed in or just take them all
          // A simple sort by population helps with layout
          const sorted = data.units.sort((a, b) => (a.population || 0) - (b.population || 0));
          setUnits(sorted);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleCountChange = (unitId, val) => {
    const num = parseInt(val, 10);
    setCounts(prev => ({
      ...prev,
      [unitId]: isNaN(num) || num < 0 ? 0 : num
    }));
  };

  const usedPopulation = units.reduce((sum, u) => {
    return sum + (counts[u.id] || 0) * (u.population || 0);
  }, 0);

  const remainingPopulation = maxPopulation - usedPopulation;

  const totalAttack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.attack || 0), 0);
  const totalDefHack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_hack || 0), 0);
  const totalDefPierce = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_pierce || 0), 0);
  const totalDefDistance = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_distance || 0), 0);

  return (
    <div className="grid gap-4" style={{ marginTop: '2rem' }}>
      <div className="glass-panel text-center">
        <h1 className="gradient-text">City & Army Planner</h1>
        <p className="text-secondary">Plan your optimal nukes and defensive compositions.</p>
      </div>
      
      {loading ? (
        <div className="glass-panel text-center"><p>Loading units...</p></div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          
          <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
            <div className="flex justify-between items-center mb-4">
              <h2>Units</h2>
              <div className="flex items-center gap-4">
                <label className="text-sm text-secondary">Max Pop:</label>
                <input 
                  type="number" 
                  className="input-field" 
                  style={{ width: '100px' }}
                  value={maxPopulation} 
                  onChange={e => setMaxPopulation(parseInt(e.target.value, 10) || 0)} 
                />
              </div>
            </div>
            
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {units.filter(u => u.population > 0).map(u => (
                <div key={u.id} style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{u.name}</div>
                  <div className="text-xs text-secondary mb-2">Pop: {u.population}</div>
                  <input 
                    type="number"
                    className="input-field text-center"
                    min="0"
                    value={counts[u.id] || ''}
                    placeholder="0"
                    onChange={e => handleCountChange(u.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ alignSelf: 'start', position: 'sticky', top: '100px' }}>
            <h2>Overview</h2>
            <div className="mt-4 p-4 text-center" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <div className="text-sm text-secondary">Population</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: remainingPopulation < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {usedPopulation} / {maxPopulation}
              </div>
              <div className="text-xs text-secondary mt-1">
                {remainingPopulation < 0 ? `${Math.abs(remainingPopulation)} Over Limit` : `${remainingPopulation} Available`}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="flex justify-between p-2" style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '4px' }}>
                <span className="text-secondary">Offensive Value</span>
                <strong style={{ color: 'var(--danger)' }}>{totalAttack}</strong>
              </div>
              <div className="flex justify-between p-2" style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '4px' }}>
                <span className="text-secondary">Def (Blunt)</span>
                <strong>{totalDefHack}</strong>
              </div>
              <div className="flex justify-between p-2" style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '4px' }}>
                <span className="text-secondary">Def (Sharp)</span>
                <strong>{totalDefPierce}</strong>
              </div>
              <div className="flex justify-between p-2" style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '4px' }}>
                <span className="text-secondary">Def (Distance)</span>
                <strong>{totalDefDistance}</strong>
              </div>
            </div>
            
            <button className="btn mt-4 w-full" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setCounts({})}>Reset Planner</button>
          </div>
          
        </div>
      )}
    </div>
  );
}
