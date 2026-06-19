'use client';
import { useState, useEffect } from 'react';
import { Target, Activity, Map as MapIcon, ShieldAlert, Crosshair, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function CommandCenter() {
  const [masterData, setMasterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSnipes, setActiveSnipes] = useState([]);

  useEffect(() => {
    // Fetch master player data
    fetch('/api/master-player')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setMasterData(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // Load active snipe groups from local storage
    const saved = localStorage.getItem('grepo-recall-groups');
    if (saved) {
      try {
        setActiveSnipes(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between border-b border-[rgba(255,255,255,0.1)] pb-4">
        <div>
          <h1 className="gradient-text text-4xl mb-2">Command Center</h1>
          <p className="text-secondary">
            {loading ? "Initializing intel..." : 
             masterData?.player ? `Welcome back, ${masterData.player.name}.` : "Standalone mode inactive. Please configure Master Player in .env"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Empire Status */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
          <div className="glass-panel">
            <h2 className="text-xl mb-4 flex items-center gap-2"><Activity size={20}/> Empire Summary</h2>
            {loading ? (
              <div className="animate-pulse flex gap-4">
                <div className="h-16 w-32 bg-[rgba(255,255,255,0.1)] rounded"></div>
                <div className="h-16 w-32 bg-[rgba(255,255,255,0.1)] rounded"></div>
              </div>
            ) : masterData?.player ? (
              <div className="flex gap-6 mb-6">
                <div>
                  <div className="text-xs text-secondary uppercase tracking-wider">Points</div>
                  <div className="text-2xl font-mono text-accent">{masterData.player.points.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary uppercase tracking-wider">Rank</div>
                  <div className="text-2xl font-mono">#{masterData.player.rank}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary uppercase tracking-wider">Cities</div>
                  <div className="text-2xl font-mono">{masterData.player.townsList?.length || masterData.player.towns}</div>
                </div>
                {masterData.player.alliance && (
                  <div>
                    <div className="text-xs text-secondary uppercase tracking-wider">Alliance</div>
                    <div className="text-xl text-primary mt-1">{masterData.player.alliance.name}</div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-secondary">No player data synced.</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[rgba(0,0,0,0.2)] p-4 rounded">
                <h3 className="text-sm text-secondary mb-2">Recent Conquers</h3>
                {masterData?.recentConquers?.length > 0 ? (
                  <ul className="text-sm flex flex-col gap-1">
                    {masterData.recentConquers.map(c => (
                      <li key={c.id} className="text-green-400 flex items-center gap-2"><MapPin size={12}/> Town #{c.townId} ({c.townPoints} pts)</li>
                    ))}
                  </ul>
                ) : <span className="text-xs text-secondary">None recently</span>}
              </div>
              <div className="bg-[rgba(0,0,0,0.2)] p-4 rounded">
                <h3 className="text-sm text-secondary mb-2">Recent Losses</h3>
                {masterData?.recentLosses?.length > 0 ? (
                  <ul className="text-sm flex flex-col gap-1">
                    {masterData.recentLosses.map(c => (
                      <li key={c.id} className="text-danger flex items-center gap-2"><MapPin size={12}/> Town #{c.townId} ({c.townPoints} pts)</li>
                    ))}
                  </ul>
                ) : <span className="text-xs text-secondary">None recently</span>}
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <h2 className="text-xl mb-4 flex items-center gap-2"><ShieldAlert size={20}/> Active Operations</h2>
            {activeSnipes.length > 0 ? (
              <div className="flex flex-col gap-2">
                {activeSnipes.map(snipe => (
                  <Link href="/snipe/recall" key={snipe.id} className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors">
                    <div>
                      <div className="font-bold text-accent">{snipe.targetCity}</div>
                      <div className="text-xs text-secondary">{snipe.worldType.toUpperCase()} - {snipe.movements.length} tracked movements</div>
                    </div>
                    <div className="text-sm font-mono text-primary bg-[rgba(255,255,255,0.1)] px-2 py-1 rounded">
                      {snipe.plans?.length || 0} Snipes Planned
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-secondary text-sm">No active snipes or defensive operations.</p>
            )}
          </div>
        </div>

        {/* Right Column: Quick Tools */}
        <div className="col-span-1 flex flex-col gap-4">
          <Link href="/snipe/recall" className="glass-panel hover:border-accent transition-colors group cursor-pointer block">
            <h3 className="flex items-center gap-2 group-hover:text-accent transition-colors"><Crosshair size={18}/> Recall Sniper</h3>
            <p className="text-secondary text-sm mt-2">Manage incoming attacks and plan precise recall snipes.</p>
          </Link>
          
          <Link href="/planner" className="glass-panel hover:border-primary transition-colors group cursor-pointer block">
            <h3 className="flex items-center gap-2 group-hover:text-primary transition-colors"><Target size={18}/> City Planner</h3>
            <p className="text-secondary text-sm mt-2">Optimize your city specializations and unit counts.</p>
          </Link>

          <Link href="/map" className="glass-panel hover:border-blue-400 transition-colors group cursor-pointer block">
            <h3 className="flex items-center gap-2 group-hover:text-blue-400 transition-colors"><MapIcon size={18}/> Strategy Map</h3>
            <p className="text-secondary text-sm mt-2">View the world map, analyze enemy clusters, and plan expansions.</p>
          </Link>
        </div>

      </div>
    </div>
  );
}
