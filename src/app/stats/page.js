"use client";

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Swords, 
  Shield, 
  TrendingUp, 
  Clock, 
  Map as MapIcon, 
  Activity,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Scoreboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world/scoreboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b101e] text-white">
        <div className="animate-pulse flex flex-col items-center">
          <Trophy size={48} className="text-yellow-500 mb-4" />
          <h2 className="text-xl tracking-widest uppercase">Loading World Data...</h2>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-white">Error loading data.</div>;

  const { conquests, topPlayers, topAlliances, gainers } = data;

  const chartData = gainers.players.pts.map(g => ({
    name: g.entity.name,
    points: g.pts
  }));

  const formatNumber = (num) => num.toLocaleString();
  
  const timeSince = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000 / 60);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
  };

  return (
    <div className="min-h-screen bg-[#0b101e] text-slate-300 p-8 pt-24 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Trophy className="text-yellow-500" size={36} />
              World Scoreboard
            </h1>
            <p className="text-slate-400">Live rankings, hourly gains, and recent conquests.</p>
          </div>
          <Link href="/map" className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition flex items-center gap-2">
            <MapIcon size={20} />
            Back to Map
          </Link>
        </div>

        {/* Top Section: Gains & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
            <div className="flex items-center gap-2 mb-6 text-white text-xl font-bold">
              <TrendingUp className="text-green-400" /> Hourly Point Gainers
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} tickMargin={10} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="points" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Combat Activity (ABP/DBP Gainers) */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4 text-white text-lg font-bold">
                <Swords className="text-red-400" /> Top Hourly Attackers
              </div>
              <div className="space-y-3">
                {gainers.players.abp.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-slate-300">{i+1}. {g.entity.name}</span>
                    <span className="text-red-400 font-bold">+{formatNumber(g.abp)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-px bg-white/10 w-full" />
            <div>
              <div className="flex items-center gap-2 mb-4 text-white text-lg font-bold">
                <Shield className="text-blue-400" /> Top Hourly Defenders
              </div>
              <div className="space-y-3">
                {gainers.players.dbp.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-slate-300">{i+1}. {g.entity.name}</span>
                    <span className="text-blue-400 font-bold">+{formatNumber(g.dbp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Conquest Feed */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-2 mb-6 text-white text-xl font-bold">
            <Activity className="text-orange-400" /> Live Conquest Feed
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-400 uppercase bg-black/20 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 rounded-tl-lg">Time</th>
                  <th className="px-6 py-4">Town</th>
                  <th className="px-6 py-4">Points</th>
                  <th className="px-6 py-4 text-right">Lost By</th>
                  <th className="px-6 py-4 text-center"></th>
                  <th className="px-6 py-4 rounded-tr-lg">Conquered By</th>
                </tr>
              </thead>
              <tbody>
                {conquests.map((c, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4 text-slate-400 flex items-center gap-2">
                      <Clock size={14} /> {timeSince(c.timestamp)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">{c.townName}</td>
                    <td className="px-6 py-4 text-slate-300">{formatNumber(c.townPoints)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-red-400 font-semibold">{c.oldPlayer}</div>
                      <div className="text-xs text-slate-500">{c.oldAlliance}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500">
                      <ArrowRight size={16} className="mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-green-400 font-semibold">{c.newPlayer}</div>
                      <div className="text-xs text-slate-500">{c.newAlliance}</div>
                    </td>
                  </tr>
                ))}
                {conquests.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No conquests recorded since last sync.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Players Table */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
            <div className="flex items-center gap-2 mb-6 text-white text-xl font-bold">
              <Trophy className="text-yellow-500" /> Top Players (Points)
            </div>
            <div className="space-y-4">
              {topPlayers.pts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:border-white/20 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-6 text-center font-bold text-slate-400">{i+1}</div>
                    <div>
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.alliance?.name || 'No Alliance'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-500">{formatNumber(p.points)}</div>
                    <div className="text-xs text-slate-400 flex gap-2 justify-end">
                      <span className="text-red-400 flex items-center gap-1"><Swords size={10}/> {formatNumber(p.abp)}</span>
                      <span className="text-blue-400 flex items-center gap-1"><Shield size={10}/> {formatNumber(p.dbp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Alliances Table */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
            <div className="flex items-center gap-2 mb-6 text-white text-xl font-bold">
              <Trophy className="text-yellow-500" /> Top Alliances (Points)
            </div>
            <div className="space-y-4">
              {topAlliances.pts.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:border-white/20 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-6 text-center font-bold text-slate-400">{i+1}</div>
                    <div className="font-semibold text-white">{a.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-500">{formatNumber(a.points)}</div>
                    <div className="text-xs text-slate-400 flex gap-2 justify-end">
                      <span className="text-red-400 flex items-center gap-1"><Swords size={10}/> {formatNumber(a.abp)}</span>
                      <span className="text-blue-400 flex items-center gap-1"><Shield size={10}/> {formatNumber(a.dbp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
