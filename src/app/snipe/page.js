'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Crosshair, Plus, Trash2, Clock, Swords, Shield, RefreshCw, ArrowRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function SnipeTimerPage() {
  const { activeWorldId, activeWorld } = useApp();
  const [targetTime, setTargetTime] = useState('');
  const [travelTime, setTravelTime] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('attack');
  const [serverOffset, setServerOffset] = useState(0);
  
  const [queue, setQueue] = useState([]);
  const [now, setNow] = useState(new Date());
  const loadedWorldRef = useRef(activeWorldId);

  // Load from local storage for active world
  useEffect(() => {
    if (!activeWorldId) return;
    loadedWorldRef.current = activeWorldId;
    try {
      const saved = localStorage.getItem(`grepo-operations-queue_${activeWorldId.toLowerCase()}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const revived = parsed.map(op => ({
          ...op,
          windowStart: new Date(op.windowStart),
          windowEnd: new Date(op.windowEnd),
          targetDate: new Date(op.targetDate)
        }));
        setQueue(revived);
      } else {
        setQueue([]);
      }
    } catch (e) {
      console.error("Failed to parse queue", e);
      setQueue([]);
    }
  }, [activeWorldId]);

  // Save to local storage only when loadedWorldRef matches
  const saveQueueState = (newQueue) => {
    if (!activeWorldId || loadedWorldRef.current !== activeWorldId) return;
    try {
      localStorage.setItem(`grepo-operations-queue_${activeWorldId.toLowerCase()}`, JSON.stringify(newQueue));
    } catch (e) {}
  };

  const updateQueue = (updater) => {
    setQueue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveQueueState(next);
      return next;
    });
  };

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncTime = async () => {
    try {
      const start = performance.now();
      const res = await fetch('/api/time');
      const data = await res.json();
      const end = performance.now();
      const latency = (end - start) / 2000;
      
      const serverDate = new Date(data.serverTime);
      const localDate = new Date();
      const diffSecs = Math.round((serverDate.getTime() / 1000) - (localDate.getTime() / 1000) + latency);
      setServerOffset(diffSecs);
    } catch (e) {
      console.error("Failed to sync server time:", e);
    }
  };

  const addToQueue = (e) => {
    e.preventDefault();
    if (!targetTime || !travelTime) return;

    const [tH, tM, tS] = targetTime.split(':').map(Number);
    const [trH, trM, trS] = travelTime.split(':').map(Number);

    const targetDate = new Date();
    targetDate.setHours(tH, tM, tS || 0, 0);
    
    if (targetDate.getTime() < new Date().getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const travelMs = (trH * 3600 + (trM || 0) * 60 + (trS || 0)) * 1000;
    
    const idealLaunchDate = new Date(targetDate.getTime() - travelMs);
    const windowStart = new Date(idealLaunchDate.getTime() - 10000);
    const windowEnd = new Date(idealLaunchDate.getTime() + 10000);

    const newOp = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      label: label || 'Standard Operation',
      type,
      targetDate,
      windowStart,
      windowEnd,
    };

    updateQueue(prev => [...prev, newOp].sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime()));
    
    setLabel('');
    setTargetTime('');
    setTravelTime('');
  };

  const removeOp = (id) => {
    updateQueue(prev => prev.filter(op => op.id !== id));
  };

  const clearQueue = () => {
    updateQueue([]);
  };

  const serverTime = new Date(now.getTime() + (serverOffset * 1000));

  const formatCountdown = (ms) => {
    if (ms < 0) return 'Passed';
    const totalSecs = Math.ceil(ms / 1000);
    if (totalSecs < 60) return `${totalSecs}s`;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
    const h = Math.floor(m / 60);
    const mRem = m % 60;
    return `${h}h ${mRem.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">
              World: {activeWorld?.name || activeWorldId.toUpperCase()}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Crosshair size={28} className="text-primary" /> Command Launch & ATR Window Calculator
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Calculate precise launch windows factoring in the ±10-second Anti-Timing-Rule (ATR).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/snipe/recall"
            className="btn btn-primary text-xs py-2 px-4"
          >
            Open Precision Recall Sniper →
          </Link>
        </div>
      </div>

      {/* Clock Calibration Card */}
      <div className="glass-panel p-4 bg-slate-900/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
            <Clock size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Server Synchronized Clock</div>
            <div className="text-2xl font-mono font-bold text-white tracking-wider">
              {serverTime.toLocaleTimeString([], { hour12: false })}
            </div>
          </div>
        </div>

        <button 
          onClick={handleSyncTime}
          className="btn btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
        >
          <RefreshCw size={13} />
          <span>{serverOffset !== 0 ? `Offset: ${serverOffset > 0 ? '+' : ''}${serverOffset}s` : 'Calibrate Server Clock'}</span>
        </button>
      </div>

      {/* Operations Form & List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Add Operation Form */}
        <div className="glass-panel p-6 bg-slate-900/90 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Plus size={18} className="text-primary" /> Schedule Command
          </h2>

          <form onSubmit={addToQueue} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Operation Label</label>
              <input 
                type="text" 
                placeholder="e.g. CS Landing / Support Wave"
                className="input-field" 
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Target Land Time</label>
                <input 
                  type="text" 
                  placeholder="HH:MM:SS"
                  className="input-field font-mono text-center" 
                  value={targetTime}
                  onChange={e => setTargetTime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Travel Duration</label>
                <input 
                  type="text" 
                  placeholder="HH:MM:SS"
                  className="input-field font-mono text-center" 
                  value={travelTime}
                  onChange={e => setTravelTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Movement Type</label>
              <select 
                className="w-full font-semibold"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                <option value="attack">Attack (Offensive)</option>
                <option value="support">Support (Defensive)</option>
                <option value="cs">Colony Ship (CS)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary text-xs py-2 mt-2">
              <Plus size={15} /> Add to Queue
            </button>
          </form>
        </div>

        {/* Queue List */}
        <div className="glass-panel p-6 bg-slate-900/90 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={18} className="text-accent" /> Active Launch Queue ({queue.length})
              </h2>
              {queue.length > 0 && (
                <button onClick={clearQueue} className="text-xs text-rose-400 hover:underline">
                  Clear All
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No active operations scheduled.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
                {queue.map(op => {
                  const msUntilStart = op.windowStart.getTime() - serverTime.getTime();
                  const msUntilEnd = op.windowEnd.getTime() - serverTime.getTime();
                  const inWindow = msUntilStart <= 0 && msUntilEnd >= 0;
                  const passed = msUntilEnd < 0;

                  return (
                    <div 
                      key={op.id} 
                      className={`p-3.5 rounded-xl border transition-all ${
                        inWindow 
                          ? 'bg-rose-950/40 border-rose-500 shadow-xl animate-pulse' 
                          : passed 
                          ? 'bg-slate-950/30 border-slate-900 opacity-50' 
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-200 text-sm">{op.label}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            Target: {op.targetDate.toLocaleTimeString([], { hour12: false })}
                          </div>
                        </div>

                        <button 
                          onClick={() => removeOp(op.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className={`font-mono font-bold ${inWindow ? 'text-rose-400' : 'text-primary'}`}>
                          {inWindow ? '🚨 LAUNCH WINDOW ACTIVE' : passed ? 'Passed' : `Send in ${formatCountdown(msUntilStart)}`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Window: {op.windowStart.toLocaleTimeString([], { hour12: false })} - {op.windowEnd.toLocaleTimeString([], { hour12: false })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
