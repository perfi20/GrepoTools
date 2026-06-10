import React, { useEffect, useState } from 'react';
import { X, Users, Trophy, Shield, Swords, Activity, MapPin } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

function formatNumber(num) {
  if (num === undefined || num === null) return "0";
  return num.toLocaleString();
}

export default function DeepDiveModal({ entity, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [viewType, setViewType] = useState('area'); // 'area' or 'bar'

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (entity.type === 'town') {
          const res = await fetch(`/api/world/town/${entity.data.id}`);
          if (res.ok) {
            setData(await res.json());
          }
        } else if (entity.type === 'player') {
          const res = await fetch(`/api/world/player/${entity.data.id}`);
          if (res.ok) {
            setData(await res.json());
          }
        } else if (entity.type === 'alliance') {
          const res = await fetch(`/api/world/alliance/${entity.data.id}`);
          if (res.ok) {
            setData(await res.json());
          }
        }
      } catch (err) {
        console.error("DeepDiveModal error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [entity]);

  const renderIcon = () => {
    if (entity.type === 'alliance') return <Users size={32} color="#a855f7" />;
    if (entity.type === 'player') return <Trophy size={32} color="#3b82f6" />;
    return <MapPin size={32} color="#10b981" />;
  };

  const getBackgroundColor = () => {
    if (entity.type === 'alliance') return 'rgba(139, 92, 246, 0.2)';
    if (entity.type === 'player') return 'rgba(59, 130, 246, 0.2)';
    return 'rgba(16, 185, 129, 0.2)';
  };

  return (
    <div 
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 16, 30, 0.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if(e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-panel" style={{ width: '800px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-panel" style={{ padding: '16px', background: getBackgroundColor() }}>
            {renderIcon()}
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: '0 0 4px 0' }}>{entity.data.name}</h2>
            {entity.type === 'player' && entity.data.alliance && (
              <div className="gradient-text" style={{ fontSize: '14px', fontWeight: '600' }}>{entity.data.alliance.name || entity.data.alliance}</div>
            )}
            {entity.type === 'town' && (
              <div className="gradient-text" style={{ fontSize: '14px', fontWeight: '600' }}>
                {entity.data.player} • {entity.data.alliance}
              </div>
            )}
            <div style={{ color: '#94a3b8', fontSize: '14px', textTransform: 'capitalize', marginTop: '4px' }}>
              {entity.type} Intelligence
              {entity.type === 'town' && ` • Island (${entity.data.islandX || entity.data.x}, ${entity.data.islandY || entity.data.y})`}
            </div>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
            <Trophy size={20} color="#eab308" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{formatNumber(entity.data.points || entity.data.pts)}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Total Points</div>
          </div>
          {(entity.type === 'player' || entity.type === 'alliance') ? (
            <>
              <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <Swords size={20} color="#ef4444" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{formatNumber(entity.data.abp)}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Attack BP</div>
              </div>
              <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <Shield size={20} color="#3b82f6" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{formatNumber(entity.data.dbp)}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Defense BP</div>
              </div>
            </>
          ) : (
            // For Towns, show rank or slot if available
            <>
               <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <MapPin size={20} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>Slot #{entity.data.islandSlot || entity.data.slot || '?'}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Island Position</div>
              </div>
              <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <Activity size={20} color="#8b5cf6" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                  {data && data.activity ? (data.activity.pointDelta > 0 ? '+' : '') + formatNumber(data.activity.pointDelta) : '0'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>7-Day Growth</div>
              </div>
            </>
          )}
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Fetching deep intelligence...
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '24px', flexDirection: entity.type === 'town' ? 'row' : 'column' }}>
            
            {/* Chart Area */}
            <div style={{ flex: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>Points History (7 Days)</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setViewType('area')} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: viewType === 'area' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: viewType === 'area' ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>Area</button>
                  <button onClick={() => setViewType('bar')} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: viewType === 'bar' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: viewType === 'bar' ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>Bar</button>
                </div>
              </div>

              <div style={{ height: '250px', width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {data?.history && data.history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {viewType === 'area' ? (
                      <AreaChart data={data.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                          itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        />
                        <Area type="stepAfter" dataKey="points" stroke="#10b981" strokeWidth={3} fill="url(#chartColor)" isAnimationActive={false} />
                      </AreaChart>
                    ) : (
                      <BarChart data={data.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                          itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        />
                        <Bar dataKey="delta" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '8px' }}>
                    <Activity size={32} color="#3b82f6" style={{ opacity: 0.5 }} />
                    <span style={{ fontWeight: '600', color: '#94a3b8' }}>Historical data assembling...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Conquest Timeline (Available for Town, Player, Alliance) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0' }}>Conquest History</h3>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto' }}>
                {data?.conquests && data.conquests.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {data.conquests.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                        <div style={{ width: '2px', background: 'rgba(255,255,255,0.1)', position: 'absolute', left: '15px', top: '30px', bottom: '-16px', display: i === data.conquests.length - 1 ? 'none' : 'block' }}></div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}>
                          <Swords size={16} color="#ef4444" />
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '12px' }}>{new Date(c.timestamp).toLocaleString()}</div>
                          <div style={{ fontSize: '14px', marginTop: '2px', lineHeight: '1.4' }}>
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{c.newPlayerObj?.name || 'Ghost'}</span> conquered from <span style={{ color: '#3b82f6' }}>{c.oldPlayerObj?.name || 'Ghost'}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Points: {formatNumber(c.townPoints)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>
                    No conquests recorded.
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
