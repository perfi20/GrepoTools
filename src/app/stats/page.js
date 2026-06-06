"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Swords, Shield, TrendingUp, Clock, Map as MapIcon, 
  Activity, ArrowRight, Search, Zap, Crosshair, Users, Target, X
} from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- MOCK DATA GENERATOR ---
const generateMockGains = (players) => {
  if (!players || players.length === 0) return [];
  return players.slice(0, 10).map((p, i) => ({
    name: p.name,
    pts: Math.floor(Math.random() * 5000) + 1000,
    abp: Math.floor(Math.random() * 3000) + 500,
    dbp: Math.floor(Math.random() * 2000) + 200
  })).sort((a,b) => b.pts - a.pts);
};

export default function ScoreboardDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [conquestFilter, setConquestFilter] = useState('');
  const [allianceSearch, setAllianceSearch] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  const [allianceMetric, setAllianceMetric] = useState('pts');
  const [playerMetric, setPlayerMetric] = useState('pts');
  
  const [mockGainers, setMockGainers] = useState({ pts: [], abp: [], dbp: [] });
  const [selectedEntity, setSelectedEntity] = useState(null);

  useEffect(() => {
    fetch('/api/world/scoreboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        
        // Mock data to prevent empty charts until cron builds history
        const basePlayers = d.players.pts;
        const mockPts = generateMockGains(basePlayers);
        const mockAbp = [...mockPts].sort((a,b) => b.abp - a.abp);
        const mockDbp = [...mockPts].sort((a,b) => b.dbp - a.dbp);
        setMockGainers({ pts: mockPts, abp: mockAbp, dbp: mockDbp });

        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const formatNumber = (num) => num ? num.toLocaleString() : '0';
  
  const timeSince = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000 / 60);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
  };

  const getMetricIcon = (metric) => {
    switch (metric) {
      case 'pts': return <Trophy size={14} className="text-yellow-500" />;
      case 'abp': return <Swords size={14} className="text-red-500" />;
      case 'dbp': return <Shield size={14} className="text-blue-500" />;
      case 'allbp': return <Target size={14} className="text-purple-500" />;
      case 'momentum': return <TrendingUp size={14} className="text-green-500" />;
      default: return null;
    }
  };

  const getMetricColor = (metric) => {
    switch (metric) {
      case 'pts': return 'text-yellow-500';
      case 'abp': return 'text-red-500';
      case 'dbp': return 'text-blue-500';
      case 'allbp': return 'text-purple-500';
      case 'momentum': return 'text-green-500';
      default: return 'text-slate-200';
    }
  };

  const filteredConquests = useMemo(() => {
    if (!data || !data.conquests) return [];
    if (!conquestFilter.trim()) return data.conquests;
    const term = conquestFilter.toLowerCase();
    return data.conquests.filter(c => 
      c.townName.toLowerCase().includes(term) ||
      c.oldPlayer.toLowerCase().includes(term) ||
      c.newPlayer.toLowerCase().includes(term) ||
      c.oldAlliance.toLowerCase().includes(term) ||
      c.newAlliance.toLowerCase().includes(term)
    );
  }, [data, conquestFilter]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: '73px', left: 0, right: 0, bottom: 0, backgroundColor: '#0b101e', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-pulse flex flex-col items-center">
          <Trophy size={48} className="text-yellow-500 mb-4" />
          <h2 className="text-xl tracking-widest uppercase text-white">Loading Intelligence...</h2>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-white p-8">Error loading data.</div>;

  // Render a list for sidebars
  const renderSidebarList = (entities, metric, search, isAlliance = false) => {
    let list = entities[metric] || [];
    if (search.trim()) {
      const lower = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(lower));
    }

    if (list.length === 0) return <div className="text-slate-500 text-center py-4 text-sm">No results found.</div>;

    return list.map((item, i) => {
      let mainValue = item[metric === 'allbp' ? 'allBp' : metric];
      if (metric === 'momentum') mainValue = item.momentum;

      return (
        <div 
          key={item.id} 
          onClick={() => setSelectedEntity({ type: isAlliance ? 'alliance' : 'player', data: item })}
          className="flex flex-col p-3 rounded-xl border transition cursor-pointer group"
          style={{ 
            background: 'var(--bg-card)', 
            borderColor: 'var(--border-color)',
            marginBottom: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-3">
              <div className="w-5 text-center font-bold text-secondary text-sm group-hover:text-primary transition-colors">{i+1}</div>
              <div className="font-bold text-white text-sm group-hover:text-primary transition-colors">{item.name}</div>
            </div>
            <div className={`font-bold text-sm ${getMetricColor(metric)}`}>
              {metric === 'momentum' ? '+' : ''}{formatNumber(mainValue)}
            </div>
          </div>
          <div className="flex justify-between items-center pl-8 text-xs">
            <span className="text-slate-500 truncate w-32">{!isAlliance ? (item.alliance?.name || 'No Alliance') : ''}</span>
            <div className="flex gap-2">
              {metric !== 'abp' && <span className="text-red-400/70 flex items-center gap-1" title="Attack BP"><Swords size={10}/> {formatNumber(item.abp)}</span>}
              {metric !== 'dbp' && <span className="text-blue-400/70 flex items-center gap-1" title="Defense BP"><Shield size={10}/> {formatNumber(item.dbp)}</span>}
            </div>
          </div>
        </div>
      );
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', color: 'white', backdropFilter: 'blur(10px)' }}>
          <p className="font-bold mb-1">{label}</p>
          <p className="text-sm" style={{ color: payload[0].fill }}>
            Gain: +{formatNumber(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ position: 'fixed', top: '73px', left: 0, right: 0, bottom: 0, backgroundColor: '#0b101e', zIndex: 10, display: 'flex', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* LEFT SIDEBAR: Alliances */}
      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)', zIndex: 2 }}>
        
        <div>
          <h1 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <Users className="text-purple-400" size={20} />
            Top Alliances
          </h1>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary" size={14} />
            <input 
              type="text" 
              placeholder="Search alliances..." 
              className="input-field"
              style={{ paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
              value={allianceSearch}
              onChange={e => setAllianceSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
          {['pts', 'abp', 'dbp', 'allbp', 'momentum'].map(m => (
            <button 
              key={m} 
              onClick={() => setAllianceMetric(m)}
              className="flex-1 flex justify-center items-center py-1.5 rounded-md transition-all cursor-pointer border-none"
              style={{ 
                background: allianceMetric === m ? 'var(--primary)' : 'transparent',
                opacity: allianceMetric === m ? 1 : 0.5,
                boxShadow: allianceMetric === m ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
              }}
              title={m.toUpperCase()}
            >
              {getMetricIcon(m)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto scrollbar-none pb-20">
          {renderSidebarList(data.alliances, allianceMetric, allianceSearch, true)}
        </div>

      </div>

      {/* MAIN CENTER PANE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.5rem', gap: '1.5rem', scrollbarWidth: 'none' }}>
        
        {/* Top Analytics: Gainers Charts (Mocked for now) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Points Gainers Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-72">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white font-bold">
                <Activity className="text-green-400" size={18}/> Points Surge (Mocked)
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockGainers.pts} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="pts" radius={[0, 4, 4, 0]}>
                    {mockGainers.pts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#10b981" fillOpacity={0.8 - (index * 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ABP Gainers Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-72">
            <div className="flex items-center gap-2 mb-4 text-white font-bold">
              <Crosshair className="text-red-500" size={18}/> Top Attackers (Mocked)
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockGainers.abp} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="abp" radius={[0, 4, 4, 0]}>
                    {mockGainers.abp.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#ef4444" fillOpacity={0.8 - (index * 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DBP Gainers Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-72">
            <div className="flex items-center gap-2 mb-4 text-white font-bold">
              <Shield className="text-blue-500" size={18}/> Top Defenders (Mocked)
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockGainers.dbp} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="dbp" radius={[0, 4, 4, 0]}>
                    {mockGainers.dbp.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#3b82f6" fillOpacity={0.8 - (index * 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Live Conquest Feed (Bottom Area) */}
        <div className="glass-panel rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col flex-1 min-h-[400px]">
          
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="text-orange-400" size={20}/>
              <h2 className="text-lg font-bold text-white">Live Conquest Feed</h2>
              <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold ml-2">
                {filteredConquests.length} events
              </span>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary" size={14} />
              <input 
                type="text" 
                placeholder="Filter feed..." 
                className="input-field"
                style={{ paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', width: '16rem' }}
                value={conquestFilter}
                onChange={e => setConquestFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 scrollbar-none">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase sticky top-0 bg-[#0c1220] z-10 shadow-md">
                <tr>
                  <th className="px-6 py-3 font-semibold rounded-tl-lg">Time</th>
                  <th className="px-6 py-3 font-semibold">Town</th>
                  <th className="px-6 py-3 font-semibold">Points</th>
                  <th className="px-6 py-3 font-semibold text-right">Lost By</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                  <th className="px-6 py-3 font-semibold rounded-tr-lg">Conquered By</th>
                </tr>
              </thead>
              <tbody>
                {filteredConquests.map((c, i) => (
                  <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                    <td className="px-6 py-3 text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-500 group-hover:text-orange-400 transition-colors"/> 
                        {timeSince(c.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-semibold text-white truncate max-w-[150px]">{c.townName}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">{formatNumber(c.townPoints)}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="text-red-400/90 font-semibold truncate max-w-[120px] inline-block">{c.oldPlayer}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{c.oldAlliance}</div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="w-6 h-6 rounded-full bg-black/40 border border-white/5 flex items-center justify-center mx-auto group-hover:border-orange-500/30 transition-colors">
                        <ArrowRight size={12} className="text-slate-500 group-hover:text-orange-400 transition-colors" />
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-green-400/90 font-semibold truncate max-w-[120px]">{c.newPlayer}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{c.newAlliance}</div>
                    </td>
                  </tr>
                ))}
                {filteredConquests.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      No conquests found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* RIGHT SIDEBAR: Players */}
      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', borderLeft: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)', zIndex: 2 }}>
        
        <div>
          <h1 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <Trophy className="text-blue-400" size={20} />
            Top Players
          </h1>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary" size={14} />
            <input 
              type="text" 
              placeholder="Search players..." 
              className="input-field"
              style={{ paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
          {['pts', 'abp', 'dbp', 'allbp', 'momentum'].map(m => (
            <button 
              key={m} 
              onClick={() => setPlayerMetric(m)}
              className="flex-1 flex justify-center items-center py-1.5 rounded-md transition-all cursor-pointer border-none"
              style={{ 
                background: playerMetric === m ? 'var(--primary)' : 'transparent',
                opacity: playerMetric === m ? 1 : 0.5,
                boxShadow: playerMetric === m ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
              }}
              title={m.toUpperCase()}
            >
              {getMetricIcon(m)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto scrollbar-none pb-20">
          {renderSidebarList(data.players, playerMetric, playerSearch, false)}
        </div>

      </div>

      {/* DEEP DIVE MODAL SKELETON */}
      {selectedEntity && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 16, 30, 0.8)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if(e.target === e.currentTarget) setSelectedEntity(null) }}
        >
          <div className="glass-panel" style={{ width: '600px', maxWidth: '90vw', position: 'relative' }}>
            <button 
              onClick={() => setSelectedEntity(null)}
              className="absolute top-4 right-4 text-secondary hover:text-white transition"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-xl glass-panel border border-white/10" style={{ background: selectedEntity.type === 'alliance' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)' }}>
                {selectedEntity.type === 'alliance' ? <Users size={32} className="text-purple-400" /> : <Trophy size={32} className="text-blue-400" />}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight mb-0">{selectedEntity.data.name}</h2>
                {selectedEntity.type === 'player' && selectedEntity.data.alliance && (
                  <div className="gradient-text text-sm font-semibold">{selectedEntity.data.alliance.name}</div>
                )}
                <div className="text-secondary text-sm capitalize">{selectedEntity.type} Intelligence</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="glass-panel p-4 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <Trophy size={20} className="text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{formatNumber(selectedEntity.data.points)}</div>
                <div className="text-xs text-secondary mt-1">Total Points</div>
              </div>
              <div className="glass-panel p-4 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <Swords size={20} className="text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{formatNumber(selectedEntity.data.abp)}</div>
                <div className="text-xs text-secondary mt-1">Attack BP</div>
              </div>
              <div className="glass-panel p-4 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <Shield size={20} className="text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{formatNumber(selectedEntity.data.dbp)}</div>
                <div className="text-xs text-secondary mt-1">Defense BP</div>
              </div>
            </div>

            <div className="h-48 border border-white/10 rounded-xl flex items-center justify-center bg-black/30 text-secondary flex-col gap-2 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              <Activity size={32} className="opacity-50 text-primary" />
              <span className="font-semibold" style={{ zIndex: 1 }}>Historical data assembling...</span>
              <span className="text-xs" style={{ zIndex: 1 }}>(Check back after a few sync cycles)</span>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
