'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trash2, Plus, AlertTriangle, Crosshair, Shield, Clock, RefreshCw, 
  Target, Volume2, VolumeX, Save, CheckCircle2, ChevronRight, Swords, ArrowRight, Building2, MapPin
} from 'lucide-react';
import DummyFinder from '@/components/CommandCenter/DummyFinder';
import { useApp } from '@/context/AppContext';
import { calculateMidpointRecall, formatDuration } from '@/lib/traveltime';

export default function RecallSnipePage() {
  const { activeWorldId, activeWorld, activePlayer, masterData } = useApp();
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [serverOffset, setServerOffset] = useState(0); // in seconds
  const [now, setNow] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);

  const loadedWorldRef = useRef(activeWorldId);

  // Input states for new group
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupWorld, setNewGroupWorld] = useState('siege');
  
  // Audio context for chirps
  const audioCtxRef = useRef(null);
  const playedChirpsRef = useRef({});

  // Input states for new movement
  const [movAttacker, setMovAttacker] = useState('');
  const [movAttackerId, setMovAttackerId] = useState(null);
  const [movType, setMovType] = useState('attack');
  const [movTime, setMovTime] = useState('');
  const [townSearchResults, setTownSearchResults] = useState([]);

  // State for custom gap minutes input
  const [customMins, setCustomMins] = useState({});

  // Intel states
  const [intelData, setIntelData] = useState({});
  const [intelLoading, setIntelLoading] = useState({});
  const [savedOpMsg, setSavedOpMsg] = useState('');

  const playChirp = useCallback((freq = 880, type = 'sine', duration = 0.12, vol = 0.6) => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio not available", e);
    }
  }, [audioEnabled]);

  // Load from local storage for active world
  useEffect(() => {
    if (!activeWorldId) return;
    loadedWorldRef.current = activeWorldId;
    try {
      const saved = localStorage.getItem(`grepo-recall-groups_${activeWorldId.toLowerCase()}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setGroups(parsed);
        if (parsed.length > 0) setActiveGroupId(parsed[0].id);
        else setActiveGroupId(null);
      } else {
        setGroups([]);
        setActiveGroupId(null);
      }
    } catch (e) {
      console.error("Failed to parse queue", e);
      setGroups([]);
      setActiveGroupId(null);
    }
  }, [activeWorldId]);

  // Save to local storage only when loadedWorldRef matches
  const saveGroupsState = (newGroups) => {
    if (!activeWorldId || loadedWorldRef.current !== activeWorldId) return;
    try {
      localStorage.setItem(`grepo-recall-groups_${activeWorldId.toLowerCase()}`, JSON.stringify(newGroups));
    } catch (e) {}
  };

  const updateGroups = (updater) => {
    setGroups(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveGroupsState(next);
      return next;
    });
  };

  // Tick every second & play audio chirps
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = new Date();
      setNow(currentTime);

      // Check active plans for audio chirps
      const activeGrp = groups.find(g => g.id === activeGroupId);
      if (activeGrp && activeGrp.plans) {
        const stMs = currentTime.getTime() + (serverOffset * 1000);
        activeGrp.plans.forEach(plan => {
          const sendDiff = Math.floor((new Date(plan.sendTime).getTime() - stMs) / 1000);
          const recallDiff = Math.floor((new Date(plan.recallTime).getTime() - stMs) / 1000);

          [
            { diff: sendDiff, key: `send_${plan.id}` },
            { diff: recallDiff, key: `recall_${plan.id}` }
          ].forEach(({ diff, key }) => {
            if (diff >= 0 && diff <= 10) {
              const chirpKey = `${key}_${diff}`;
              if (!playedChirpsRef.current[chirpKey]) {
                playedChirpsRef.current[chirpKey] = true;
                if (diff === 0) {
                  playChirp(1200, 'triangle', 0.4, 0.9); // Big alert at T-0!
                } else if (diff <= 3) {
                  playChirp(950, 'sine', 0.15, 0.7);
                } else if (diff === 5 || diff === 10) {
                  playChirp(700, 'sine', 0.1, 0.5);
                }
              }
            }
          });
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [groups, activeGroupId, serverOffset, playChirp]);

  const handleSyncTime = async () => {
    try {
      const start = performance.now();
      const res = await fetch('/api/time');
      const data = await res.json();
      const end = performance.now();
      const latency = (end - start) / 2000; // in seconds
      
      const serverDate = new Date(data.serverTime);
      const localDate = new Date();
      const diffSecs = Math.round((serverDate.getTime() / 1000) - (localDate.getTime() / 1000) + latency);
      setServerOffset(diffSecs);
    } catch (e) {
      console.error("Failed to sync server time:", e);
    }
  };

  const serverTime = new Date(now.getTime() + (serverOffset * 1000));

  // Search towns API
  const searchTowns = async (query) => {
    if (!query || query.length < 2) {
      setTownSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/world/search?world=${activeWorldId}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setTownSearchResults(data.towns || []);
    } catch (e) {
      console.error("Failed to search towns:", e);
    }
  };

  const createGroup = (e) => {
    if (e) e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      worldType: newGroupWorld,
      movements: [],
      plans: []
    };

    updateGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
  };

  const handleQuickAddMyTown = (town) => {
    if (!town) return;
    const newGroup = {
      id: Date.now().toString(),
      name: `${town.name} (${town.islandX}, ${town.islandY})`,
      targetTownId: town.id,
      worldType: activeWorld?.worldType || 'siege',
      movements: [],
      plans: []
    };
    updateGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
  };

  const deleteGroup = (id) => {
    updateGroups(prev => {
      const next = prev.filter(g => g.id !== id);
      if (activeGroupId === id) {
        setActiveGroupId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const addMovement = (e) => {
    e.preventDefault();
    if (!activeGroupId || !movTime.trim()) return;

    // Parse time
    const parts = movTime.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.length < 2 || parts.some(isNaN)) {
      alert("Please enter a valid time format (HH:MM:SS or HH:MM)");
      return;
    }

    const targetDate = new Date(serverTime);
    targetDate.setHours(parts[0], parts[1], parts[2] || 0, 0);

    // If target time is earlier than current server time, assume next day
    if (targetDate.getTime() <= serverTime.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const movement = {
      id: Date.now().toString(),
      attacker: movAttacker.trim() || 'Unknown Movement',
      attackerId: movAttackerId,
      type: movType,
      targetTime: targetDate.toISOString()
    };

    updateGroups(prev => prev.map(g => {
      if (g.id === activeGroupId) {
        const nextMovements = [...g.movements, movement].sort(
          (a, b) => new Date(a.targetTime).getTime() - new Date(b.targetTime).getTime()
        );
        return { ...g, movements: nextMovements };
      }
      return g;
    }));

    setMovAttacker('');
    setMovAttackerId(null);
    setMovTime('');
    setTownSearchResults([]);
  };

  const deleteMovement = (movementId) => {
    updateGroups(prev => prev.map(g => {
      if (g.id === activeGroupId) {
        return { ...g, movements: g.movements.filter(m => m.id !== movementId) };
      }
      return g;
    }));
  };

  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Calculate gaps between incoming attacks and Colony Ship
  const calculateGaps = () => {
    if (!activeGroup || activeGroup.movements.length < 2) return [];

    const movs = activeGroup.movements;
    const gaps = [];

    for (let i = 0; i < movs.length; i++) {
      const current = movs[i];
      if (current.type === 'cs') {
        // Look for preceding attack
        for (let j = i - 1; j >= 0; j--) {
          if (movs[j].type === 'attack') {
            const tPrev = new Date(movs[j].targetTime).getTime();
            const tCS = new Date(current.targetTime).getTime();
            const diffSeconds = Math.round((tCS - tPrev) / 1000);
            gaps.push({
              id: `gap_${movs[j].id}_${current.id}`,
              type: 'pre_cs',
              label: `Pre-CS Gap (${diffSeconds}s window)`,
              prevMovement: movs[j],
              csMovement: current,
              targetTime: current.targetTime,
              gapSeconds: diffSeconds
            });
            break;
          }
        }

        // Look for subsequent support
        for (let k = i + 1; k < movs.length; k++) {
          if (movs[k].type === 'support') {
            const tCS = new Date(current.targetTime).getTime();
            const tSupp = new Date(movs[k].targetTime).getTime();
            const diffSeconds = Math.round((tSupp - tCS) / 1000);
            gaps.push({
              id: `gap_${current.id}_${movs[k].id}`,
              type: 'post_cs',
              label: `Post-CS Defense Gap (${diffSeconds}s window)`,
              csMovement: current,
              nextMovement: movs[k],
              targetTime: movs[k].targetTime,
              gapSeconds: diffSeconds
            });
            break;
          }
        }
      }
    }

    return gaps;
  };

  const handleGeneratePlan = (targetTimeIso, defaultMins = 5) => {
    if (!activeGroup) return;

    const mins = customMins[targetTimeIso] !== undefined ? customMins[targetTimeIso] : defaultMins;
    const targetDate = new Date(targetTimeIso);
    const durationSeconds = mins * 60;

    const result = calculateMidpointRecall(targetDate, durationSeconds);

    const plan = {
      id: Date.now().toString(),
      targetTime: result.targetReturnTime.toISOString(),
      sendTime: result.sendTime.toISOString(),
      recallTime: result.recallTime.toISOString(),
      durationSeconds: result.travelDurationSeconds,
      worldType: activeGroup.worldType
    };

    updateGroups(prev => prev.map(g => {
      if (g.id === activeGroupId) {
        return { ...g, plans: [...(g.plans || []), plan] };
      }
      return g;
    }));
  };

  const deletePlan = (planId) => {
    updateGroups(prev => prev.map(g => {
      if (g.id === activeGroupId) {
        return { ...g, plans: (g.plans || []).filter(p => p.id !== planId) };
      }
      return g;
    }));
  };

  const handleSaveToOperations = async (plan) => {
    try {
      const res = await fetch('/api/snipe/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId: activeWorldId,
          label: `Recall Snipe for ${activeGroup.name}`,
          type: 'recall',
          worldType: activeGroup.worldType,
          targetTownId: activeGroup.targetTownId || 1,
          originTownId: activeGroup.targetTownId || 1,
          targetReturnTime: plan.targetTime,
          sendTime: plan.sendTime,
          recallTime: plan.recallTime,
          notes: `Precision midpoint snipe (${Math.round(plan.durationSeconds / 60)}m launch)`
        })
      });

      const d = await res.json();
      if (d.success) {
        setSavedOpMsg(`Operation saved to database successfully!`);
        setTimeout(() => setSavedOpMsg(''), 3000);
      }
    } catch (e) {
      alert("Failed to save operation: " + e.message);
    }
  };

  const formatCountdown = (ms) => {
    if (ms < 0) return 'DONE';
    const totalSecs = Math.ceil(ms / 1000);
    if (totalSecs < 60) return `${totalSecs}s`;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
    const h = Math.floor(m / 60);
    const mRem = m % 60;
    return `${h}h ${mRem.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const gaps = calculateGaps();
  const myTowns = masterData?.player?.townsList || [];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">
              World: {activeWorld?.name || activeWorldId.toUpperCase()} ({activeWorld?.worldType?.toUpperCase()})
            </span>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1 border transition-colors ${
                audioEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {audioEnabled ? 'Audio Alerts ON' : 'Audio Muted'}
            </button>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Crosshair size={28} className="text-accent" /> Precision Midpoint Recall Sniper
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Bypass the ±10s Anti-Timing-Rule (ATR) by launching attacks in advance and canceling exactly at the midpoint.
          </p>
        </div>

        {/* Live Server Clock & Calibration */}
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Calibrated Server Time</div>
            <div className="text-xl font-mono font-bold text-primary mt-0.5">
              {serverTime.toLocaleTimeString([], { hour12: false })}
            </div>
          </div>
          <button 
            onClick={handleSyncTime}
            className="btn btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            title="Sync server clock offset"
          >
            <RefreshCw size={13} />
            <span>{serverOffset !== 0 ? `${serverOffset > 0 ? '+' : ''}${serverOffset}s` : 'Sync'}</span>
          </button>
        </div>
      </div>

      {savedOpMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fade-in font-mono">
          <CheckCircle2 size={16} /> {savedOpMsg}
        </div>
      )}

      {/* Target City Groups Navigation */}
      <div className="glass-panel p-4 bg-slate-900/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                g.id === activeGroupId 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <span>{g.name}</span>
              <span className="text-[11px] opacity-75 font-mono">({g.movements?.length || 0})</span>
            </button>
          ))}
        </div>

        {/* Add Group Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Quick-add from player's own towns if logged in */}
          {myTowns.length > 0 && (
            <select
              onChange={(e) => {
                const found = myTowns.find(t => t.id.toString() === e.target.value);
                if (found) handleQuickAddMyTown(found);
                e.target.value = '';
              }}
              defaultValue=""
              className="text-xs py-1.5 px-2 bg-slate-950/80 border-slate-800 text-slate-200"
            >
              <option value="" disabled>+ Add From My Cities...</option>
              {myTowns.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.islandX}, {t.islandY})</option>
              ))}
            </select>
          )}

          {/* Add custom group form */}
          <form onSubmit={createGroup} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Target City Name..."
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="input-field py-1.5 px-3 text-xs w-40"
            />
            <button type="submit" className="btn btn-primary text-xs py-1.5 px-3">
              <Plus size={14} /> Add City
            </button>
          </form>
        </div>
      </div>

      {/* Active Group Content */}
      {activeGroup ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Movement Queue & Gap Analyzer */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Movements Input Panel */}
            <div className="glass-panel p-5 rounded-2xl bg-slate-900/80">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">{activeGroup.name}</h2>
                  <p className="text-xs text-slate-400">Incoming attack & support timetable</p>
                </div>
                <button
                  onClick={() => deleteGroup(activeGroup.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Delete this city group"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Add Movement Form */}
              <form onSubmit={addMovement} className="grid grid-cols-1 gap-2.5 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Attacker / Origin Town..."
                    value={movAttacker}
                    onChange={e => { setMovAttacker(e.target.value); searchTowns(e.target.value); }}
                    className="input-field py-1.5 px-2 text-xs"
                  />
                  {townSearchResults.length > 0 && (
                    <div className="absolute z-20 bg-slate-900 border border-slate-700 rounded-lg p-1 mt-1 max-h-36 overflow-y-auto w-full shadow-xl">
                      {townSearchResults.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setMovAttacker(`${t.name} (${t.player?.name || 'Ghost'})`);
                            setMovAttackerId(t.id);
                            setTownSearchResults([]);
                          }}
                          className="w-full text-left p-1.5 hover:bg-slate-800 rounded text-xs text-slate-200"
                        >
                          {t.name} • {t.player?.name || 'Ghost'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={movType}
                    onChange={e => setMovType(e.target.value)}
                    className="input-field py-1.5 px-2 text-xs font-semibold"
                  >
                    <option value="attack">Clear Attack</option>
                    <option value="cs">Colony Ship (CS)</option>
                    <option value="support">Support</option>
                  </select>

                  <input
                    type="text"
                    placeholder="HH:MM:SS (e.g. 18:30:00)"
                    value={movTime}
                    onChange={e => setMovTime(e.target.value)}
                    className="input-field py-1.5 px-2 text-xs font-mono text-center"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary text-xs py-1.5 w-full">
                  <Plus size={14} /> Add Command
                </button>
              </form>

              {/* Movements List */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {activeGroup.movements.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No incoming commands added yet.
                  </div>
                ) : (
                  activeGroup.movements.map((mov) => {
                    const isCS = mov.type === 'cs';
                    const isAttack = mov.type === 'attack';
                    const timeObj = new Date(mov.targetTime);
                    const formattedTime = timeObj.toLocaleTimeString([], { hour12: false });

                    return (
                      <div 
                        key={mov.id}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs border transition-all ${
                          isCS 
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-200' 
                            : isAttack 
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                            isCS ? 'badge badge-danger' : isAttack ? 'badge badge-warning' : 'badge badge-primary'
                          }`}>
                            {mov.type.toUpperCase()}
                          </span>
                          <span className="font-medium text-white truncate max-w-[120px]">{mov.attacker}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-white">{formattedTime}</span>
                          <button
                            onClick={() => deleteMovement(mov.id)}
                            className="text-slate-500 hover:text-rose-400 p-0.5"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Gap Opportunities Analyzer */}
            {gaps.length > 0 && (
              <div className="glass-panel p-4 bg-slate-900/80 rounded-2xl border border-primary/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                  <Crosshair size={15} /> Identified Snipe Windows ({gaps.length})
                </h3>

                <div className="space-y-3">
                  {gaps.map((gap) => (
                    <div key={gap.id} className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
                      <div className="font-bold text-white mb-1">{gap.label}</div>
                      <div className="text-slate-400 font-mono text-[11px] mb-2">
                        Target Exact Time: <strong className="text-primary">{new Date(gap.targetTime).toLocaleTimeString([], { hour12: false })}</strong>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <span className="text-slate-400 text-[11px]">Travel (mins):</span>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          defaultValue={5}
                          onChange={(e) => setCustomMins({ ...customMins, [gap.targetTime]: parseInt(e.target.value, 10) || 5 })}
                          className="w-12 text-center bg-slate-900 border border-slate-700 rounded py-0.5 font-mono text-xs text-white"
                        />
                        <button
                          onClick={() => handleGeneratePlan(gap.targetTime)}
                          className="btn btn-primary text-xs py-1 px-3 ml-auto"
                        >
                          Generate Plan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Columns: Tactical Execution Dashboard & Countdown */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="glass-panel p-5 rounded-2xl bg-slate-900/80">
              <h2 className="text-base font-bold text-white tracking-tight mb-1 flex items-center gap-2">
                <Target size={18} className="text-primary" /> Active Precision Recall Plans ({activeGroup.plans?.length || 0})
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Launch an attack to a neutral dummy town, then click Recall at the midpoint to land on the second!
              </p>

              {(!activeGroup.plans || activeGroup.plans.length === 0) ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                  <Clock size={32} className="mx-auto mb-2 text-slate-600" />
                  <div className="text-sm font-semibold text-slate-300">No active recall plans generated yet</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Add incoming movements or use the Gap Analyzer on the left to calculate send and recall timestamps.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGroup.plans.map((plan, idx) => {
                    const stMs = serverTime.getTime();
                    const sendDiff = Math.floor((new Date(plan.sendTime).getTime() - stMs) / 1000);
                    const recallDiff = Math.floor((new Date(plan.recallTime).getTime() - stMs) / 1000);
                    const isSendImminent = sendDiff >= 0 && sendDiff <= 30;
                    const isRecallImminent = recallDiff >= 0 && recallDiff <= 30;

                    return (
                      <div 
                        key={plan.id || idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          isRecallImminent 
                            ? 'bg-rose-950/40 border-rose-500/60 shadow-lg' 
                            : isSendImminent 
                              ? 'bg-amber-950/40 border-amber-500/60 shadow-lg' 
                              : 'bg-slate-950/70 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-800/80 gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="badge badge-accent">
                              Plan #{idx + 1}
                            </span>
                            <span className="text-xs font-mono text-slate-300 font-bold">
                              Land Target: {new Date(plan.targetTime).toLocaleTimeString([], { hour12: false })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveToOperations(plan)}
                              className="btn btn-secondary text-xs py-1 px-3"
                              title="Save to Command Center Operations Queue"
                            >
                              <Save size={13} /> Save Op
                            </button>
                            <button
                              onClick={() => deletePlan(plan.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Delete Plan"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Step Timetable */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                          
                          {/* Step 1: Send */}
                          <div className={`p-3 rounded-xl border ${isSendImminent ? 'bg-amber-500/20 border-amber-500/40' : 'bg-slate-900/60 border-slate-800'}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Step 1: Launch Attack</span>
                              <span className="font-mono text-xs font-bold text-amber-400">
                                {sendDiff > 0 ? formatCountdown(sendDiff * 1000) : 'LAUNCHED'}
                              </span>
                            </div>
                            <div className="text-lg font-mono font-bold text-white">
                              {new Date(plan.sendTime).toLocaleTimeString([], { hour12: false })}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Target any dummy city at least {Math.ceil(plan.durationSeconds / 60)} mins away.
                            </div>
                          </div>

                          {/* Step 2: Cancel / Recall */}
                          <div className={`p-3 rounded-xl border ${isRecallImminent ? 'bg-rose-500/20 border-rose-500/40' : 'bg-slate-900/60 border-slate-800'}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Step 2: Cancel / Recall</span>
                              <span className="font-mono text-xs font-bold text-rose-400">
                                {recallDiff > 0 ? formatCountdown(recallDiff * 1000) : 'RECALLED'}
                              </span>
                            </div>
                            <div className="text-lg font-mono font-bold text-white">
                              {new Date(plan.recallTime).toLocaleTimeString([], { hour12: false })}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Click the red ✕ cancel button in Grepolis at this exact second!
                            </div>
                          </div>

                        </div>

                        {/* Dummy Target Finder Helper for this plan */}
                        <DummyFinder 
                          originTownId={activeGroup.targetTownId}
                          durationSeconds={plan.durationSeconds}
                          worldSpeed={activeWorld?.speed || 2}
                          worldId={activeWorldId}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="glass-panel p-12 text-center rounded-2xl bg-slate-900/80">
          <Crosshair size={48} className="mx-auto mb-3 text-slate-600" />
          <h2 className="text-xl font-bold text-white mb-1">No Target City Selected</h2>
          <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto">
            Choose one of your cities from the dropdown above or enter a custom city name to begin calculating precision midpoint snipes.
          </p>
        </div>
      )}

    </div>
  );
}
