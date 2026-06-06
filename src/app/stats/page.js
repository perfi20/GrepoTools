"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Swords, Shield, TrendingUp, Clock, Map as MapIcon, 
  Activity, ArrowRight, Search, Zap, Crosshair
} from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function ScoreboardDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conquestFilter, setConquestFilter] = useState('');

  useEffect(() => {
    fetch('/api/world/scoreboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const formatNumber = (num) => num.toLocaleString();
  
  const timeSince = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000 / 60);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
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

  const { topPlayers, topAlliances, gainers } = data;

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
      
      {/* LEFT SIDEBAR: Global Rankings */}
      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)', scrollbarWidth: 'none' }}>
        
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Trophy className="text-yellow-500" size={24} />
            Global Rankings
          </h1>
          <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider">Server Leaderboards</p>
        </div>

        {/* Top Players Table */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-white font-bold mb-2">
            <TrendingUp size={18} className="text-blue-400" /> Top 10 Players
          </div>
          {topPlayers.pts.map((p, i) => (
            <div key={i} className="flex flex-col p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-5 text-center font-bold text-slate-500 text-sm">{i+1}</div>
                  <div className="font-bold text-slate-200 text-sm">{p.name}</div>
                </div>
                <div className="font-bold text-yellow-500 text-sm">{formatNumber(p.points)}</div>
              </div>
              <div className="flex justify-between items-center pl-8 text-xs">
                <span className="text-slate-500 truncate w-32">{p.alliance?.name || 'No Alliance'}</span>
                <div className="flex gap-3">
                  <span className="text-red-400 flex items-center gap-1"><Swords size={12}/> {formatNumber(p.abp)}</span>
                  <span className="text-blue-400 flex items-center gap-1"><Shield size={12}/> {formatNumber(p.dbp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Alliances Table */}
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center gap-2 text-white font-bold mb-2">
            <TrendingUp size={18} className="text-purple-400" /> Top 10 Alliances
          </div>
          {topAlliances.pts.map((a, i) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition">
              <div className="flex items-center gap-3">
                <div className="w-5 text-center font-bold text-slate-500 text-sm">{i+1}</div>
                <div className="font-bold text-slate-200 text-sm">{a.name}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="font-bold text-yellow-500 text-sm">{formatNumber(a.points)}</div>
                <div className="flex gap-2 text-xs">
                  <span className="text-red-400 flex items-center gap-1"><Swords size={10}/> {formatNumber(a.abp)}</span>
                  <span className="text-blue-400 flex items-center gap-1"><Shield size={10}/> {formatNumber(a.dbp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* MAIN CENTER PANE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.5rem', gap: '1.5rem' }}>
        
        {/* Top Analytics: Gainers Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Points Gainers Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-80">
            <div className="flex items-center gap-2 mb-4 text-white font-bold">
              <Activity className="text-green-400" size={18}/> Hourly Points Surge
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gainers.players.pts.map(g => ({ name: g.entity.name, value: g.pts }))} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {gainers.players.pts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#10b981" fillOpacity={0.8 - (index * 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ABP Gainers Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-80">
            <div className="flex items-center gap-2 mb-4 text-white font-bold">
              <Crosshair className="text-red-500" size={18}/> Highest Attackers (1h)
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gainers.players.abp.map(g => ({ name: g.entity.name, value: g.abp }))} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {gainers.players.abp.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#ef4444" fillOpacity={0.8 - (index * 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DBP Gainers Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-80">
            <div className="flex items-center gap-2 mb-4 text-white font-bold">
              <Shield className="text-blue-500" size={18}/> Top Defenders (1h)
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gainers.players.dbp.map(g => ({ name: g.entity.name, value: g.dbp }))} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {gainers.players.dbp.map((entry, index) => (
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
          
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="text-orange-400" size={20}/>
              <h2 className="text-lg font-bold text-white">Live Conquest Feed</h2>
              <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold ml-2">
                {filteredConquests.length} events
              </span>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Filter player, alliance, town..." 
                className="pl-9 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50 transition w-64"
                value={conquestFilter}
                onChange={e => setConquestFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 scrollbar-thin">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase sticky top-0 bg-[#0d1323] z-10">
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
                  <tr key={i} className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors group">
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-500 group-hover:text-orange-400 transition-colors"/> 
                        {timeSince(c.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white truncate max-w-[200px]">{c.townName}</td>
                    <td className="px-6 py-4 text-slate-300 font-mono">{formatNumber(c.townPoints)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-red-400 font-semibold truncate max-w-[150px] inline-block">{c.oldPlayer}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{c.oldAlliance}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="w-8 h-8 rounded-full bg-black/30 border border-white/5 flex items-center justify-center mx-auto group-hover:border-orange-500/30 transition-colors">
                        <ArrowRight size={14} className="text-slate-500 group-hover:text-orange-400 transition-colors" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-green-400 font-semibold truncate max-w-[150px]">{c.newPlayer}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{c.newAlliance}</div>
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

    </div>
  );
}
