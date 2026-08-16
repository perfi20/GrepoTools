"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  Trophy, Swords, Shield, TrendingUp, Clock,
  Activity, ArrowRight, Search, Zap, Crosshair, Users, Target, X, Pin, Loader2,
  ArrowUpRight, ArrowDownRight, Minus, Skull, HelpCircle, MapPin, ChevronDown, Filter, Globe, ExternalLink, UserCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, AreaChart, Area } from 'recharts';
import DeepDiveModal from '@/components/DeepDiveModal';
import { useApp } from '@/context/AppContext';

export default function ScoreboardDashboard() {
  const { activeWorldId, activeWorld, switchPlayer } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [conquestFilter, setConquestFilter] = useState('');
  
  const [allianceSearch, setAllianceSearch] = useState('');
  const [allianceIsSearching, setAllianceIsSearching] = useState(false);
  const [allianceSearchResults, setAllianceSearchResults] = useState([]);

  const [playerSearch, setPlayerSearch] = useState('');
  const [playerIsSearching, setPlayerIsSearching] = useState(false);
  const [playerSearchResults, setPlayerSearchResults] = useState([]);

  const [allianceMetric, setAllianceMetric] = useState('pts');
  const [playerMetric, setPlayerMetric] = useState('pts');
  
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedHourlyEntity, setSelectedHourlyEntity] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [hourlyViewType, setHourlyViewType] = useState('bar');
  const [showFaq, setShowFaq] = useState(false);

  // Pinned Entities per world
  const [pinnedPlayers, setPinnedPlayers] = useState([]);
  const [pinnedAlliances, setPinnedAlliances] = useState([]);
  const loadedWorldRef = useRef(activeWorldId);

  // Chart specific search states
  const [chartSearches, setChartSearches] = useState({
    a_pts: '', a_abp: '', a_dbp: '',
    p_pts: '', p_abp: '', p_dbp: ''
  });
  const [chartSearchResults, setChartSearchResults] = useState({
    a_pts: [], a_abp: [], a_dbp: [],
    p_pts: [], p_abp: [], p_dbp: []
  });
  const [chartIsSearching, setChartIsSearching] = useState({
    a_pts: false, a_abp: false, a_dbp: false,
    p_pts: false, p_abp: false, p_dbp: false
  });

  // Load world data and scoped pinned entities
  useEffect(() => {
    if (!activeWorldId) return;
    setLoading(true);
    loadedWorldRef.current = activeWorldId;

    try {
      const p = localStorage.getItem(`grepoPinnedPlayers_${activeWorldId.toLowerCase()}`);
      const a = localStorage.getItem(`grepoPinnedAlliances_${activeWorldId.toLowerCase()}`);
      setPinnedPlayers(p ? JSON.parse(p) : []);
      setPinnedAlliances(a ? JSON.parse(a) : []);
    } catch(e) {
      setPinnedPlayers([]);
      setPinnedAlliances([]);
    }

    fetch(`/api/world/scoreboard?world=${activeWorldId.toLowerCase()}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error("Scoreboard fetch error:", err);
        setLoading(false);
      });
  }, [activeWorldId]);

  // Save pinned entities ONLY when loadedWorld matches activeWorldId
  const savePinnedState = (newPlayers, newAlliances) => {
    if (!activeWorldId || loadedWorldRef.current !== activeWorldId) return;
    try {
      if (newPlayers !== undefined) {
        localStorage.setItem(`grepoPinnedPlayers_${activeWorldId.toLowerCase()}`, JSON.stringify(newPlayers));
      }
      if (newAlliances !== undefined) {
        localStorage.setItem(`grepoPinnedAlliances_${activeWorldId.toLowerCase()}`, JSON.stringify(newAlliances));
      }
    } catch(e) {}
  };

  const togglePin = (item, isAlliance) => {
    if (isAlliance) {
      setPinnedAlliances(prev => {
        const next = prev.find(p => p.id === item.id) ? prev.filter(p => p.id !== item.id) : [...prev, item];
        savePinnedState(undefined, next);
        return next;
      });
    } else {
      setPinnedPlayers(prev => {
        const next = prev.find(p => p.id === item.id) ? prev.filter(p => p.id !== item.id) : [...prev, item];
        savePinnedState(next, undefined);
        return next;
      });
    }
  };

  // Sidebar Search API (Alliances)
  useEffect(() => {
    if (allianceSearch.length >= 2 && activeWorldId) {
      setAllianceIsSearching(true);
      const timer = setTimeout(() => {
        fetch(`/api/world/search?world=${activeWorldId}&q=${encodeURIComponent(allianceSearch)}`)
          .then(res => res.json())
          .then(d => { setAllianceSearchResults(d.alliances || []); setAllianceIsSearching(false); })
          .catch(() => setAllianceIsSearching(false));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAllianceSearchResults([]);
      setAllianceIsSearching(false);
    }
  }, [allianceSearch, activeWorldId]);

  // Sidebar Search API (Players)
  useEffect(() => {
    if (playerSearch.length >= 2 && activeWorldId) {
      setPlayerIsSearching(true);
      const timer = setTimeout(() => {
        fetch(`/api/world/search?world=${activeWorldId}&q=${encodeURIComponent(playerSearch)}`)
          .then(res => res.json())
          .then(d => { setPlayerSearchResults(d.players || []); setPlayerIsSearching(false); })
          .catch(() => setPlayerIsSearching(false));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPlayerSearchResults([]);
      setPlayerIsSearching(false);
    }
  }, [playerSearch, activeWorldId]);

  // Helper to handle Chart specific searches
  const handleChartSearch = (chartKey, query, type) => {
    setChartSearches(prev => ({ ...prev, [chartKey]: query }));
    
    if (query.length >= 2 && activeWorldId) {
      setChartIsSearching(prev => ({ ...prev, [chartKey]: true }));
      if (window[`timer_${chartKey}`]) clearTimeout(window[`timer_${chartKey}`]);
      
      window[`timer_${chartKey}`] = setTimeout(() => {
        fetch(`/api/world/momentum?world=${activeWorldId}&q=${encodeURIComponent(query)}&type=${type}`)
          .then(res => res.json())
          .then(d => {
            setChartSearchResults(prev => ({ ...prev, [chartKey]: d.results || [] }));
            setChartIsSearching(prev => ({ ...prev, [chartKey]: false }));
          })
          .catch(() => setChartIsSearching(prev => ({ ...prev, [chartKey]: false })));
      }, 300);
    } else {
      setChartSearchResults(prev => ({ ...prev, [chartKey]: [] }));
      setChartIsSearching(prev => ({ ...prev, [chartKey]: false }));
    }
  };

  const formatNumber = (num) => num ? num.toLocaleString() : '0';
  
  const timeSince = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000 / 60);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
  };

  const getMetricColorHex = (metric) => {
    switch (metric) {
      case 'pts': return '#f59e0b';
      case 'abp': return '#ef4444';
      case 'dbp': return '#3b82f6';
      case 'allbp': return '#8b5cf6';
      case 'conquests': return '#10b981';
      case 'losses': return '#f43f5e';
      default: return '#94a3b8';
    }
  };

  const getMetricIcon = (metric, size = 18, active = false) => {
    const color = active ? getMetricColorHex(metric) : '#64748b';
    switch (metric) {
      case 'pts': return <Trophy size={size} color={color} />;
      case 'abp': return <Swords size={size} color={color} />;
      case 'dbp': return <Shield size={size} color={color} />;
      case 'allbp': return <Zap size={size} color={color} />;
      case 'conquests': return <Target size={size} color={color} />;
      case 'losses': return <Skull size={size} color={color} />;
      default: return null;
    }
  };

  const filteredConquests = useMemo(() => {
    if (!data || !data.conquests) return [];
    if (!conquestFilter.trim()) return data.conquests;
    const term = conquestFilter.toLowerCase();
    return data.conquests.filter(c => 
      (c.townName || '').toLowerCase().includes(term) ||
      (c.oldPlayer || '').toLowerCase().includes(term) ||
      (c.newPlayer || '').toLowerCase().includes(term) ||
      (c.oldAlliance || '').toLowerCase().includes(term) ||
      (c.newAlliance || '').toLowerCase().includes(term)
    );
  }, [data, conquestFilter]);

  const handleOpenHourly = (item, metricKey, isAlliance, colorHex) => {
    setSelectedHourlyEntity({
      id: item.id,
      name: item.name,
      type: isAlliance ? 'alliance' : 'player',
      metricKey,
      colorHex
    });
    setHourlyLoading(true);
    setHourlyData([]);

    fetch(`/api/world/history/hourly?world=${activeWorldId}&id=${item.id}&type=${isAlliance ? 'alliance' : 'player'}`)
      .then(res => res.json())
      .then(d => {
        setHourlyData(d.history || []);
        setHourlyLoading(false);
      })
      .catch(err => {
        console.error(err);
        setHourlyLoading(false);
      });
  };

  const getTrendPill = (item, metric) => {
    if (item._isFetchingTrend) {
      return (
        <span className="flex items-center px-1.5 text-accent">
          <Loader2 size={12} className="animate-spin" />
        </span>
      );
    }

    let trendValue, gainsA, gainsB;
    if (metric === 'pts') { trendValue = item.trendPts; gainsA = item.gainsAPts; gainsB = item.gainsBPts; }
    else if (metric === 'abp') { trendValue = item.trendAbp; gainsA = item.gainsAAbp; gainsB = item.gainsBAbp; }
    else if (metric === 'dbp') { trendValue = item.trendDbp; gainsA = item.gainsADbp; gainsB = item.gainsBDbp; }
    else { trendValue = item.trendPts; gainsA = item.gainsAPts; gainsB = item.gainsBPts; }

    if (trendValue === undefined || trendValue === null || isNaN(trendValue)) return null;

    let color = 'text-slate-400 bg-slate-800/50 border-slate-700';
    let Icon = Minus;
    if (trendValue > 5) { color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'; Icon = ArrowUpRight; }
    else if (trendValue < -5) { color = 'text-rose-400 bg-rose-500/10 border-rose-500/30'; Icon = ArrowDownRight; }

    return (
      <span 
        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${color}`}
        title={`Momentum: ${trendValue > 0 ? '+' : ''}${trendValue}% (Today: +${formatNumber(gainsA || 0)} vs Yesterday: +${formatNumber(gainsB || 0)})`}
      >
        <Icon size={12} />
        {trendValue > 0 ? `+${trendValue}%` : `${trendValue}%`}
      </span>
    );
  };

  // Render ranking navigation tab
  const renderRankingNav = (selectedMetric, setMetric) => {
    const tabs = [
      { id: 'pts', label: 'Points' },
      { id: 'abp', label: 'Offense' },
      { id: 'dbp', label: 'Defense' },
      { id: 'allbp', label: 'Combat' },
      { id: 'conquests', label: 'Conquests' },
      { id: 'losses', label: 'Losses' }
    ];

    return (
      <div className="flex gap-1 overflow-x-auto pb-1 mb-2.5 scrollbar-none">
        {tabs.map(tab => {
          const active = selectedMetric === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMetric(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                active 
                  ? 'bg-primary/20 border-primary/50 text-white shadow-sm' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {getMetricIcon(tab.id, 13, active)}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Render Left & Right Sidebar Lists
  const renderSidebarList = (dataset, metric, searchQuery, searchResults, isSearching, isAlliance) => {
    if (searchQuery.length >= 2) {
      if (isSearching) {
        return (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin text-primary" /> Searching {isAlliance ? 'alliances' : 'players'}...
          </div>
        );
      }
      if (!searchResults || searchResults.length === 0) {
        return <div className="py-8 text-center text-slate-500 text-xs">No matching results found.</div>;
      }
      return (
        <div className="flex flex-col gap-1.5">
          {searchResults.map((item, idx) => {
            const isPinned = (isAlliance ? pinnedAlliances : pinnedPlayers).some(p => p.id === item.id);
            return (
              <div 
                key={item.id || idx}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => setSelectedEntity({ type: isAlliance ? 'alliance' : 'player', data: item })}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePin(item, isAlliance); }}
                    className={`p-1 rounded hover:bg-slate-800 ${isPinned ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}
                  >
                    <Pin size={13} fill={isPinned ? '#f59e0b' : 'none'} />
                  </button>
                  <div className="truncate">
                    <div className="font-bold text-slate-200 text-xs truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {isAlliance ? `${item.members || 0} members • ${item.towns || 0} towns` : item.alliance?.name || 'No Alliance'}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs font-bold text-primary">{formatNumber(item.points || item.pts)}</div>
                  <div className="text-[10px] text-slate-400 font-mono">ABP: {formatNumber(item.abp)}</div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (!dataset) return null;
    const items = dataset[metric] || [];
    const pinnedList = isAlliance ? pinnedAlliances : pinnedPlayers;

    return (
      <div className="flex flex-col gap-1.5">
        {/* Pinned Section */}
        {pinnedList.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1 flex items-center gap-1">
              <Pin size={11} fill="#f59e0b" /> Pinned {isAlliance ? 'Alliances' : 'Players'}
            </div>
            <div className="flex flex-col gap-1">
              {pinnedList.map(item => (
                <div 
                  key={`pinned_${item.id}`}
                  className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer"
                  onClick={() => setSelectedEntity({ type: isAlliance ? 'alliance' : 'player', data: item })}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); togglePin(item, isAlliance); }}
                      className="text-amber-400 p-1 hover:bg-slate-800 rounded"
                    >
                      <Pin size={13} fill="#f59e0b" />
                    </button>
                    <div className="truncate">
                      <div className="font-bold text-amber-200 text-xs truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isAlliance ? `${item.members || 0} members` : item.alliance?.name || 'No Alliance'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getTrendPill(item, metric)}
                    <span className="font-mono text-xs font-bold text-white">{formatNumber(item.points || item.pts || item[metric])}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regular Top List */}
        {items.map((item, idx) => {
          const isPinned = pinnedList.some(p => p.id === item.id);
          const rank = idx + 1;
          const val = item.value !== undefined ? item.value : (item.points || item.pts || item[metric] || 0);

          return (
            <div 
              key={item.id || idx}
              className={`group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                rank <= 3 
                  ? 'bg-slate-900/90 border-slate-700/80 hover:border-primary/50' 
                  : 'bg-slate-950/60 hover:bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
              }`}
              onClick={() => setSelectedEntity({ type: isAlliance ? 'alliance' : 'player', data: item })}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-5 text-center font-mono font-bold text-xs ${
                  rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500'
                }`}>
                  #{rank}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePin(item, isAlliance); }}
                  className={`p-1 rounded hover:bg-slate-800 ${isPinned ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-400'}`}
                >
                  <Pin size={12} fill={isPinned ? '#f59e0b' : 'none'} />
                </button>
                <div className="truncate">
                  <div className="font-bold text-slate-200 text-xs truncate group-hover:text-primary transition-colors">{item.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {isAlliance ? `${item.members || 0} members` : (item.alliance?.name || item.alliance || 'No Alliance')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {getTrendPill(item, metric)}
                <span className="font-mono text-xs font-bold text-white">{formatNumber(val)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Momentum Bar Chart Panels
  const renderChartPanel = (title, icon, type, dataKey, chartSearchKey, metricKey, colorHex) => {
    const isAlliance = type === 'alliances';
    const isSearching = chartIsSearching[chartSearchKey];
    const searchResults = chartSearchResults[chartSearchKey];
    const searchVal = chartSearches[chartSearchKey];

    let chartItems = [];
    if (searchVal.length >= 2 && searchResults) {
      chartItems = searchResults.map(r => ({
        ...r,
        gainVal: metricKey === 'momentumPts' ? r.gainsAPts : metricKey === 'momentumAbp' ? r.gainsAAbp : r.gainsADbp
      })).slice(0, 7);
    } else {
      chartItems = (data?.[type]?.[dataKey] || []).map(r => ({
        ...r,
        gainVal: r.dailyGain !== undefined ? r.dailyGain : (r.gain || 0)
      })).slice(0, 7);
    }

    return (
      <div className="glass-panel p-4 bg-slate-900/90 border border-slate-800/90 rounded-2xl flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-slate-800 border border-slate-700/60">{icon}</span>
              <div>
                <h3 className="font-bold text-sm text-white tracking-tight">{title}</h3>
                <span className="text-[11px] text-slate-400">Daily velocity (2:00 AM)</span>
              </div>
            </div>

            <div className="relative w-36">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter..."
                value={searchVal}
                onChange={(e) => handleChartSearch(chartSearchKey, e.target.value, isAlliance ? 'alliance' : 'player')}
                className="input-field text-xs py-1 pl-7 pr-2 rounded-lg bg-slate-950/70 border-slate-800"
              />
            </div>
          </div>

          <div className="h-44 w-full">
            {isSearching ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 animate-pulse gap-1.5">
                <Loader2 size={13} className="animate-spin text-primary" /> Updating...
              </div>
            ) : chartItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartItems} layout="vertical" margin={{ top: 4, right: 35, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={90} 
                    tick={{ fill: '#cbd5e1', fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                    formatter={(val) => [`+${formatNumber(val)}`, 'Daily Gain']}
                  />
                  <Bar 
                    dataKey="gainVal" 
                    fill={colorHex} 
                    radius={[0, 4, 4, 0]}
                    onClick={(entry) => handleOpenHourly(entry, metricKey, isAlliance, colorHex)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <LabelList dataKey="gainVal" position="right" formatter={(v) => `+${formatNumber(v)}`} fill="#94a3b8" fontSize={10} fontFamily="JetBrains Mono" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No activity recorded today.
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Click any bar for hourly velocity breakdown</span>
          <span className="font-mono text-primary font-semibold">{chartItems.length} listed</span>
        </div>
      </div>
    );
  };

  const chartAlliancesPts = useMemo(() => renderChartPanel("Alliance Points Momentum", <Trophy size={16} color="#f59e0b" />, "alliances", "momentumPts", "a_pts", "momentumPts", "#f59e0b"), [data?.alliances?.momentumPts, chartSearches.a_pts, chartIsSearching.a_pts, chartSearchResults.a_pts]);
  const chartAlliancesAbp = useMemo(() => renderChartPanel("Alliance Attack Battle Points", <Swords size={16} color="#ef4444" />, "alliances", "momentumAbp", "a_abp", "momentumAbp", "#ef4444"), [data?.alliances?.momentumAbp, chartSearches.a_abp, chartIsSearching.a_abp, chartSearchResults.a_abp]);
  const chartAlliancesDbp = useMemo(() => renderChartPanel("Alliance Defense Battle Points", <Shield size={16} color="#3b82f6" />, "alliances", "momentumDbp", "a_dbp", "momentumDbp", "#3b82f6"), [data?.alliances?.momentumDbp, chartSearches.a_dbp, chartIsSearching.a_dbp, chartSearchResults.a_dbp]);
  
  const chartPlayersPts = useMemo(() => renderChartPanel("Player Points Momentum", <Activity size={16} color="#f59e0b" />, "players", "momentumPts", "p_pts", "momentumPts", "#f59e0b"), [data?.players?.momentumPts, chartSearches.p_pts, chartIsSearching.p_pts, chartSearchResults.p_pts]);
  const chartPlayersAbp = useMemo(() => renderChartPanel("Player Attack Battle Points", <Crosshair size={16} color="#ef4444" />, "players", "momentumAbp", "p_abp", "momentumAbp", "#ef4444"), [data?.players?.momentumAbp, chartSearches.p_abp, chartIsSearching.p_abp, chartSearchResults.p_abp]);
  const chartPlayersDbp = useMemo(() => renderChartPanel("Player Defense Battle Points", <Shield size={16} color="#3b82f6" />, "players", "momentumDbp", "p_dbp", "momentumDbp", "#3b82f6"), [data?.players?.momentumDbp, chartSearches.p_dbp, chartIsSearching.p_dbp, chartSearchResults.p_dbp]);

  if (loading) {
    return (
      <div className="fixed top-[73px] inset-x-0 bottom-0 bg-[#080d1a] z-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Trophy size={42} className="text-amber-400 animate-pulse" />
          <h2 className="text-base font-mono tracking-widest text-slate-200 uppercase">Synchronizing Intelligence...</h2>
          <span className="text-xs text-slate-400 font-mono">World: {activeWorldId.toUpperCase()}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed top-[73px] inset-x-0 bottom-0 bg-[#080d1a] z-20 flex items-center justify-center p-6 text-center">
        <div className="glass-panel max-w-md p-6">
          <h2 className="text-lg font-bold text-white mb-2">No Scoreboard Intelligence Available</h2>
          <p className="text-sm text-slate-400 mb-4">World data has not been synchronized yet for {activeWorldId.toUpperCase()}.</p>
          <Link href="/world" className="btn btn-primary text-xs">
            Open Admin Center to Sync World
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-[73px] inset-x-0 bottom-0 bg-[#080d1a] z-10 flex overflow-hidden">
      
      {/* LEFT SIDEBAR: Top Alliances */}
      <div className="w-80 lg:w-96 flex flex-col p-4 border-r border-slate-800/80 bg-slate-950/50 shrink-0 z-20">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users size={20} className="text-accent" /> Top Alliances
            </h1>
            <span className="badge badge-primary font-mono text-[10px]">
              {activeWorldId.toUpperCase()}
            </span>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search alliances globally..." 
              className="input-field text-xs pl-8 py-2 bg-slate-900/80 border-slate-700/80"
              value={allianceSearch}
              onChange={e => setAllianceSearch(e.target.value)}
            />
          </div>

          {renderRankingNav(allianceMetric, setAllianceMetric)}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {renderSidebarList(data.alliances, allianceMetric, allianceSearch, allianceSearchResults, allianceIsSearching, true)}
        </div>
      </div>

      {/* MAIN CENTER PANE: Momentum & Conquest Feed */}
      <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-6 scrollbar-thin">
        
        {/* Momentum Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Daily Momentum Tracking (Active Since 2:00 AM)
            </h2>
            <button onClick={() => setShowFaq(!showFaq)} className="text-slate-400 hover:text-white p-1" title="Explanation">
              <HelpCircle size={15} />
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            World Speed: <strong className="text-primary">{activeWorld?.speed || 1}x</strong> • Unit: <strong className="text-primary">{activeWorld?.unitSpeed || 1}x</strong>
          </div>
        </div>

        {/* 6 Momentum Bar Charts (Alliances Row Top, Players Row Bottom) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {chartAlliancesPts}
          {chartAlliancesAbp}
          {chartAlliancesDbp}
          {chartPlayersPts}
          {chartPlayersAbp}
          {chartPlayersDbp}
        </div>

        {/* Live Conquest Feed Table */}
        <div className="glass-panel p-0 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">Live Conquest Intel Feed</h2>
              <span className="badge badge-warning text-[10px]">
                {filteredConquests.length} events logged
              </span>
            </div>
            
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filter towns, players, alliances..." 
                className="input-field text-xs pl-8 py-1.5 bg-slate-900 border-slate-700/80"
                value={conquestFilter}
                onChange={e => setConquestFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[480px] scrollbar-thin">
            <table className="table-sleek">
              <thead>
                <tr>
                  <th className="w-24">Time</th>
                  <th>Target City</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Previous Owner</th>
                  <th className="text-center w-28">Status</th>
                  <th>Conquered By</th>
                  <th className="text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredConquests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                      No conquest events recorded in the current active world.
                    </td>
                  </tr>
                ) : (
                  filteredConquests.map((c, i) => {
                    const isInternal = c.oldAlliance && c.newAlliance && c.oldAlliance === c.newAlliance;
                    const isGhost = !c.oldPlayer;

                    return (
                      <tr key={c.id || i} className="hover:bg-slate-800/40">
                        <td className="font-mono text-xs text-slate-400">
                          {timeSince(c.timestamp)}
                        </td>

                        <td>
                          <button
                            onClick={() => setSelectedEntity({ type: 'town', data: { id: c.townId, name: c.townName } })}
                            className="font-bold text-slate-200 hover:text-primary transition-colors text-left flex items-center gap-1.5"
                          >
                            <MapPin size={13} className="text-emerald-400 shrink-0" />
                            <span>{c.townName || `Town #${c.townId}`}</span>
                          </button>
                        </td>

                        <td className="text-right font-mono font-semibold text-slate-300">
                          {formatNumber(c.townPoints)}
                        </td>

                        <td className="text-right">
                          {isGhost ? (
                            <span className="text-slate-500 italic text-xs">Ghost Town</span>
                          ) : (
                            <div>
                              <button
                                onClick={() => setSelectedEntity({ type: 'player', data: { id: c.oldPlayerId, name: c.oldPlayer } })}
                                className="font-medium text-slate-300 hover:text-white"
                              >
                                {c.oldPlayer}
                              </button>
                              {c.oldAlliance && (
                                <div className="text-[10px] text-slate-400 font-mono">[{c.oldAlliance}]</div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="text-center">
                          {isInternal ? (
                            <span className="badge badge-accent text-[10px]">INTERNAL</span>
                          ) : isGhost ? (
                            <span className="badge badge-warning text-[10px]">COLONIZED</span>
                          ) : (
                            <span className="badge badge-danger text-[10px]">CONQUERED</span>
                          )}
                        </td>

                        <td>
                          <div>
                            <button
                              onClick={() => setSelectedEntity({ type: 'player', data: { id: c.newPlayerId, name: c.newPlayer } })}
                              className="font-bold text-white hover:text-primary"
                            >
                              {c.newPlayer}
                            </button>
                            {c.newAlliance && (
                              <div className="text-[10px] text-accent font-mono font-semibold">[{c.newAlliance}]</div>
                            )}
                          </div>
                        </td>

                        <td className="text-right">
                          <Link
                            href="/snipe/recall"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white inline-flex"
                            title="Plan Recall Snipe"
                          >
                            <Crosshair size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* RIGHT SIDEBAR: Top Players */}
      <div className="w-80 lg:w-96 flex flex-col p-4 border-l border-slate-800/80 bg-slate-950/50 shrink-0 z-20">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Trophy size={20} className="text-amber-400" /> Top Players
            </h1>
            <span className="badge badge-primary font-mono text-[10px]">
              {activeWorldId.toUpperCase()}
            </span>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search players globally..." 
              className="input-field text-xs pl-8 py-2 bg-slate-900/80 border-slate-700/80"
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
            />
          </div>

          {renderRankingNav(playerMetric, setPlayerMetric)}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {renderSidebarList(data.players, playerMetric, playerSearch, playerSearchResults, playerIsSearching, false)}
        </div>
      </div>

      {/* Deep Dive Entity Modal */}
      {selectedEntity && (
        <DeepDiveModal 
          entity={selectedEntity} 
          onClose={() => setSelectedEntity(null)} 
          worldId={activeWorldId}
        />
      )}

      {/* Hourly Velocity Modal */}
      {selectedHourlyEntity && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedHourlyEntity(null); }}
        >
          <div className="glass-panel w-full max-w-3xl p-6 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl relative">
            <button 
              onClick={() => setSelectedHourlyEntity(null)} 
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="mb-5 border-b border-slate-800 pb-3 pr-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock size={20} style={{ color: selectedHourlyEntity.colorHex }} /> 
                Hourly Velocity: {selectedHourlyEntity.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Today's delta progression recorded since 2:00 AM server time</p>
            </div>

            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setHourlyViewType('bar')}
                className={`btn text-xs py-1.5 px-3 rounded-lg ${hourlyViewType === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Hourly Bars
              </button>
              <button 
                onClick={() => setHourlyViewType('area')}
                className={`btn text-xs py-1.5 px-3 rounded-lg ${hourlyViewType === 'area' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Cumulative Area
              </button>
            </div>

            <div className="h-64 w-full">
              {hourlyLoading ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                  <Loader2 size={20} className="animate-spin text-primary" /> Loading hourly logs...
                </div>
              ) : hourlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No hourly data snapshots recorded yet for this entity today.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {hourlyViewType === 'bar' ? (
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={formatNumber} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff' }}
                        formatter={(val) => [`+${formatNumber(val)}`, 'Gain']}
                      />
                      <Bar 
                        dataKey={selectedHourlyEntity.metricKey.toLowerCase().includes('abp') ? 'abpDelta' : selectedHourlyEntity.metricKey.toLowerCase().includes('dbp') ? 'dbpDelta' : 'ptsDelta'} 
                        fill={selectedHourlyEntity.colorHex} 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  ) : (
                    <AreaChart data={hourlyData}>
                      <defs>
                        <linearGradient id="hourlyColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={selectedHourlyEntity.colorHex} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={selectedHourlyEntity.colorHex} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={formatNumber} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff' }}
                        formatter={(val) => [`+${formatNumber(val)}`, 'Cumulative']}
                      />
                      <Area type="monotone" dataKey="cumulative" stroke={selectedHourlyEntity.colorHex} strokeWidth={2} fill="url(#hourlyColor)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
