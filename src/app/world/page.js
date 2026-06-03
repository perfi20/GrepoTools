"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function WorldDashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch('/api/world/status')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.lastSync) {
          setLastSync(new Date(data.lastSync));
        }
      })
      .catch(console.error);
  }, []);

  const triggerSync = async () => {
    setLoading(true);
    setError("");
    setStats(null);
    setMessage("");
    try {
      const res = await fetch("/api/world/sync");
      const data = await res.json();
      if (data.success) {
        if (data.skipped) {
            setMessage(data.message);
        } else {
            setStats(data.stats);
        }
        if (data.lastSync) setLastSync(new Date(data.lastSync));
      } else {
        setError(data.error || "Failed to sync world data.");
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            World Data Center
          </h1>
          <p className="text-gray-400 mt-2">Manage your personalized game database.</p>
        </div>
        <button
          onClick={triggerSync}
          disabled={loading}
          className="px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all 
            disabled:opacity-50 disabled:cursor-not-allowed
            bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 
            flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Syncing World (This takes a few seconds)
            </>
          ) : (
            <>
              <Image src="/globe.svg" alt="Globe" width={20} height={20} className="invert" />
              Sync Now
            </>
          )}
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-8 flex justify-between items-center text-sm">
         <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${lastSync ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-gray-300">
                Data Freshness: {lastSync ? (
                    <span className="font-semibold text-white">Last updated {lastSync.toLocaleTimeString()}</span>
                ) : 'Never synced'}
            </span>
         </div>
         {lastSync && (
             <div className="text-gray-400">
                 Next update available at: {new Date(lastSync.getTime() + 50 * 60000).toLocaleTimeString()}
             </div>
         )}
      </div>

      {message && (
        <div className="bg-blue-500/10 border border-blue-500/50 text-blue-300 p-4 rounded-lg mb-6 flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <p>{message}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
          <h3 className="font-bold">Sync Failed</h3>
          <p>{error}</p>
        </div>
      )}

      {stats && (
        <div className="glass-panel p-6 rounded-xl animate-fade-in">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            Sync Successful
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Total Towns</div>
              <div className="text-2xl font-mono tabular-nums">{stats.towns.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Total Players</div>
              <div className="text-2xl font-mono tabular-nums">{stats.players.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Total Alliances</div>
              <div className="text-2xl font-mono tabular-nums">{stats.alliances.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Total Islands</div>
              <div className="text-2xl font-mono tabular-nums">{stats.islands.toLocaleString()}</div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-blue-300 mb-3 border-b border-white/10 pb-2">History Deltas Inserted (Point Changes)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white/5 p-4 rounded-lg flex justify-between items-center border border-blue-500/20">
              <span className="text-gray-300">Town Changes</span>
              <span className="text-xl font-mono text-blue-400">+{stats.deltas.towns}</span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg flex justify-between items-center border border-blue-500/20">
              <span className="text-gray-300">Player Changes</span>
              <span className="text-xl font-mono text-blue-400">+{stats.deltas.players}</span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg flex justify-between items-center border border-blue-500/20">
              <span className="text-gray-300">Alliance Changes</span>
              <span className="text-xl font-mono text-blue-400">+{stats.deltas.alliances}</span>
            </div>
          </div>
        </div>
      )}

      {!stats && !loading && (
        <div className="glass-panel p-8 rounded-xl text-center flex flex-col items-center justify-center border border-white/5">
          <Image src="/globe.svg" alt="Globe" width={64} height={64} className="invert opacity-20 mb-4" />
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Your database is standing by.</h2>
          <p className="text-gray-500 max-w-md">
            Click 'Sync Now' to pull the latest map data from the Grepolis servers. 
            Once hosted on Vercel, this will automatically happen in the background every hour to build your private historical statistics!
          </p>
        </div>
      )}
    </div>
  );
}
