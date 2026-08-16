import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Copy, X, Swords, Users, ExternalLink, Activity, Crosshair } from 'lucide-react';

export default function IslandModal({ islandData, onClose, customColors, onTownClick, worldId = 'hu119' }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/world/island?world=${worldId}&x=${islandData.x}&y=${islandData.y}`);
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
  }, [islandData.x, islandData.y, worldId]);

  const handleCopyBBCode = () => {
    if (!details) return;
    const bbCodes = details.towns.filter(t => t.player).map(t => `[town]${t.id}[/town]`).join('\n');
    navigator.clipboard.writeText(bbCodes);
    setCopiedMsg("Copied town BB-Codes to clipboard!");
    setTimeout(() => setCopiedMsg(''), 3000);
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`[island]${islandData.x}|${islandData.y}[/island]`);
    setCopiedMsg("Copied island coordinates to clipboard!");
    setTimeout(() => setCopiedMsg(''), 3000);
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl relative flex flex-col">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="border-b border-slate-800 pb-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <MapPin size={22} className="text-primary" /> Island ({islandData.x}, {islandData.y})
              </h2>
              <span className="badge badge-primary">
                World {worldId.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Slots: <strong className="text-slate-200">{islandData.colonizedCount}</strong> / {islandData.availableTowns + islandData.colonizedCount} • Buffs: <span className="text-emerald-400 font-semibold">+{islandData.resourcePlus}</span> / <span className="text-rose-400 font-semibold">-{islandData.resourceMinus}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopyCoords} 
              className="btn btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            >
              <Copy size={13} /> Copy [island]
            </button>
            <button 
              onClick={handleCopyBBCode} 
              className="btn btn-primary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            >
              <Copy size={13} /> Copy All Towns
            </button>
          </div>
        </div>

        {copiedMsg && (
          <div className="mb-4 p-2.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl text-center font-mono animate-fade-in">
            {copiedMsg}
          </div>
        )}

        {/* Alliance Dominance Bar */}
        {totalPoints > 0 && (
          <div className="mb-6 p-4 bg-slate-950/70 rounded-xl border border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Users size={14} className="text-accent" /> Island Territorial Dominance
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-800 w-full mb-3 shadow-inner">
              {Object.entries(alliancePoints).map(([ally, pts], i) => {
                const percent = (pts / totalPoints) * 100;
                const color = customColors?.[ally] || ['#3b82f6', '#ef4444', '#10b981', '#a855f7', '#f97316', '#06b6d4'][i % 6];
                return (
                  <div 
                    key={ally} 
                    style={{ width: `${percent}%`, backgroundColor: color }}
                    title={`${ally}: ${Math.round(percent)}% (${pts.toLocaleString()} pts)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              {Object.entries(alliancePoints).map(([ally, pts], i) => {
                const percent = Math.round((pts / totalPoints) * 100);
                const color = customColors?.[ally] || ['#3b82f6', '#ef4444', '#10b981', '#a855f7', '#f97316', '#06b6d4'][i % 6];
                return (
                  <div key={ally} className="flex items-center gap-1.5 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }}></span>
                    <span className="font-medium text-slate-200">{ally}</span>
                    <span className="text-slate-400 font-mono">({percent}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Towns on this island */}
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-1.5">
            <Swords size={16} className="text-primary" /> Towns on this Island ({details?.towns?.length || 0})
          </h3>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm animate-pulse flex items-center justify-center gap-2">
              <Activity size={16} className="animate-spin text-primary" /> Loading island intelligence...
            </div>
          ) : details?.towns?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {details.towns.map((town) => {
                const hasPlayer = Boolean(town.player);
                const isGhost = !hasPlayer;
                const actDelta = town.activity?.pointDelta || 0;

                return (
                  <div
                    key={town.id}
                    className="p-3.5 bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-200 text-sm">{town.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Slot #{town.islandSlot} • ID: {town.id}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-accent">
                            {town.points?.toLocaleString()} pts
                          </span>
                          {actDelta !== 0 && (
                            <div className={`text-[11px] font-mono ${actDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {actDelta > 0 ? `+${actDelta}` : actDelta} (7d)
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          {isGhost ? (
                            <span className="text-slate-500 italic">Ghost Town</span>
                          ) : (
                            <span className="text-slate-300 truncate max-w-[160px] inline-block">
                              <strong className="text-white">{town.player.name}</strong>
                              {town.player.alliance && (
                                <span className="text-slate-400"> [{town.player.alliance.name}]</span>
                              )}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href="/snipe/recall"
                            className="text-slate-400 hover:text-accent p-1 transition-colors"
                            title="Plan Recall Snipe on this city"
                          >
                            <Crosshair size={14} />
                          </Link>
                          {onTownClick && (
                            <button
                              onClick={() => onTownClick(town)}
                              className="text-primary hover:underline text-xs flex items-center gap-1 font-semibold"
                            >
                              Inspect →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm">No colonized towns on this island.</div>
          )}
        </div>

      </div>
    </div>
  );
}
