import React, { useEffect, useState } from 'react';

export default function IslandModal({ islandData, onClose, customColors }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/world/island?x=${islandData.x}&y=${islandData.y}`);
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch (err) {
        console.error("Failed to fetch island details", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [islandData.x, islandData.y]);

  const handleCopyBBCode = () => {
    if (!details) return;
    const bbCodes = details.towns.filter(t => t.player).map(t => `[town]${t.id}[/town]`).join('\n');
    navigator.clipboard.writeText(bbCodes);
    alert("Copied Town BB-Codes to clipboard!");
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`[island]${islandData.x}|${islandData.y}[/island]`);
    alert("Copied Island Coordinates to clipboard!");
  };

  // Calculate dominance dynamically based on points
  let totalPoints = 0;
  const alliancePoints = {};

  if (details) {
    details.towns.forEach(t => {
      totalPoints += t.points;
      const ally = t.player?.alliance?.name || 'No Alliance';
      alliancePoints[ally] = (alliancePoints[ally] || 0) + t.points;
    });
  }

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 100,
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '2rem',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}>
      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .close-btn:hover { background: rgba(239, 68, 68, 0.8); }
      `}</style>
      
      <button className="close-btn" onClick={onClose}>✕</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }} className="gradient-text">
            Island ({islandData.x}, {islandData.y})
          </h2>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Capacity: {islandData.colonizedCount} / {islandData.availableTowns + islandData.colonizedCount} • Buffs: +{islandData.resourcePlus} / -{islandData.resourceMinus}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: 'white' }} onClick={handleCopyCoords}>Copy [island]</button>
          <button className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: 'white' }} onClick={handleCopyBBCode}>Copy [town]s</button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          Fetching detailed intelligence...
        </div>
      ) : details ? (
        <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
          
          {/* Left Column: Stats & Reports */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '1rem' }}>
            
            {/* Dominance Bar */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#f8fafc' }}>Alliance Dominance</h3>
              <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {totalPoints.toLocaleString()} Total Points
              </div>
              <div style={{ width: '100%', height: '12px', borderRadius: '6px', display: 'flex', overflow: 'hidden', background: '#1e293b' }}>
                {Object.entries(alliancePoints).sort((a,b)=>b[1]-a[1]).map(([ally, pts]) => {
                  const pct = (pts / totalPoints) * 100;
                  const color = customColors[ally] || '#eab308';
                  return <div key={ally} style={{ width: `${pct}%`, background: color }} title={`${ally}: ${pct.toFixed(1)}%`} />
                })}
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(alliancePoints).sort((a,b)=>b[1]-a[1]).map(([ally, pts]) => {
                  const pct = (pts / totalPoints) * 100;
                  const color = customColors[ally] || '#eab308';
                  return (
                    <div key={ally} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, marginRight: '4px' }} />
                      {ally} ({pct.toFixed(1)}%)
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Reports (Battle Activity) */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#f8fafc' }}>Recent Activity (14d)</h3>
              {details.reports.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>No known battles recorded for this island recently.</div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {details.reports.map(r => (
                    <div key={r.id} style={{ fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '2px' }}>{new Date(r.date).toLocaleDateString()}</div>
                      <div>
                        <span style={{ color: '#ef4444' }}>{r.attackerTown || r.attacker}</span> 
                        {' ⚔️ '} 
                        <span style={{ color: '#3b82f6' }}>{r.defenderTown || r.defender}</span>
                      </div>
                      {(r.lootedWood > 0 || r.lootedStone > 0 || r.lootedIron > 0) && (
                        <div style={{ color: '#eab308', marginTop: '2px' }}>
                          Loot: {(r.lootedWood + r.lootedStone + r.lootedIron).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>

          {/* Right Column: Town Roster */}
          <div style={{ flex: 1.5, background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#f8fafc' }}>Island Roster</h3>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {details.towns.map(t => {
                const isGhost = !t.player;
                const delta = t.activity?.pointDelta || 0;
                const allyName = t.player?.alliance?.name || 'No Alliance';
                const allyColor = customColors[allyName] || '#94a3b8';

                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', borderLeft: `4px solid ${isGhost ? '#64748b' : allyColor}` }}>
                    <div style={{ width: '2rem', color: '#64748b', fontWeight: 'bold', fontSize: '0.9rem' }}>#{t.islandSlot}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: isGhost ? '#94a3b8' : 'white', fontSize: '1rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {isGhost ? 'Ghost Town' : t.player.name} • {allyName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#10b981', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1rem' }}>{t.points.toLocaleString()}</div>
                      <div style={{ color: delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {delta > 0 ? '+' : ''}{delta.toLocaleString()} (7d)
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Render Empty Slots to visualize capacity */}
              {Array.from({ length: details.island.availableTowns }).map((_, i) => (
                <div key={`empty-${i}`} style={{ display: 'flex', alignItems: 'center', background: 'rgba(16, 185, 129, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ width: '2rem', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>-</div>
                  <div style={{ flex: 1, color: '#10b981', fontStyle: 'italic', fontSize: '0.9rem' }}>Empty Slot</div>
                  <div style={{ fontSize: '0.8rem', color: '#10b981', opacity: 0.8 }}>Available to Colonize</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>Failed to load island data.</div>
      )}

    </div>
  );
}
