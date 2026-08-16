'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trash2, Plus, AlertTriangle, Crosshair, Shield, Clock, RefreshCw, 
  Target, Volume2, VolumeX, Save, CheckCircle2, ChevronRight, Swords, ArrowRight 
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
    const saved = localStorage.getItem(`grepo-recall-groups_${activeWorldId}`) || localStorage.getItem('grepo-recall-groups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGroups(parsed);
        if (parsed.length > 0) setActiveGroupId(parsed[0].id);
      } catch (e) {
        console.error("Failed to parse queue", e);
      }
    } else {
      setGroups([]);
      setActiveGroupId(null);
    }
  }, [activeWorldId]);

  // Save to local storage
  useEffect(() => {
    if (!activeWorldId) return;
    localStorage.setItem(`grepo-recall-groups_${activeWorldId}`, JSON.stringify(groups));
  }, [groups, activeWorldId]);

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

  const serverTime = new Date(now.getTime() + (serverOffset * 1000));

  const handleSyncTime = async () => {
    try {
      const start = Date.now();
      const res = await fetch('/api/time');
      const data = await res.json();
      const end = Date.now();
      const rtt = end - start;
      const serverTimeMs = data.serverTime + (rtt / 2);
      const diffMs = serverTimeMs - end;
      setServerOffset(Math.round(diffMs / 1000));
    } catch (e) {
      console.error("Failed to sync time", e);
    }
  };

  const searchTowns = async (q) => {
    if (q.length < 2) {
      setTownSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/world/search?world=${activeWorldId}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setTownSearchResults(data.towns || []);
    } catch (e) {}
  };

  const createGroup = (e) => {
    e.preventDefault();
    if (!newGroupName) return;
    const townObj = activePlayer?.townsList?.find(t => t.name === newGroupName);
    const newGroup = {
      id: Date.now().toString(),
      name: newGroupName,
      townId: townObj ? townObj.id : null,
      worldType: newGroupWorld || activeWorld?.worldType || 'siege',
      movements: [],
      plans: []
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
  };

  const deleteGroup = (id) => {
    const newGroups = groups.filter(g => g.id !== id);
    setGroups(newGroups);
    if (activeGroupId === id) {
      setActiveGroupId(newGroups.length > 0 ? newGroups[0].id : null);
    }
  };

  const activeGroup = groups.find(g => g.id === activeGroupId);

  const getTargetDate = (timeStr) => {
    const [tH, tM, tS] = timeStr.split(':').map(Number);
    const targetDate = new Date();
    targetDate.setHours(tH, tM, tS, 0);
    if (targetDate.getTime() < new Date().getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    return targetDate.toISOString();
  };

  const addMovement = (e) => {
    e.preventDefault();
    if (!activeGroup || !movTime) return;
    
    const targetDateStr = getTargetDate(movTime);

    const newMov = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      attacker: movAttacker || 'Unknown',
      attackerId: movAttackerId,
      type: movType,
      arrivalTime: targetDateStr
    };

    const updatedGroups = groups.map(g => {
      if (g.id === activeGroup.id) {
        return {
          ...g,
          movements: [...g.movements, newMov].sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime())
        };
      }
      return g;
    });
    setGroups(updatedGroups);
    setMovAttacker('');
    setMovAttackerId(null);
    setTownSearchResults([]);
    setMovTime('');
    setMovType('attack');
  };

  const deleteMovement = (movId) => {
    const updatedGroups = groups.map(g => {
      if (g.id === activeGroup.id) {
        return { ...g, movements: g.movements.filter(m => m.id !== movId) };
      }
      return g;
    });
    setGroups(updatedGroups);
  };

  // Gap Calculations
  const calculateGaps = () => {
    if (!activeGroup || activeGroup.movements.length === 0) return [];
    
    const csMovements = activeGroup.movements.filter(m => m.type === 'cs');
    const gaps = [];

    csMovements.forEach(cs => {
      const csTime = new Date(cs.arrivalTime).getTime();
      const beforeAttacks = activeGroup.movements.filter(m => m.type === 'attack' && new Date(m.arrivalTime).getTime() < csTime);
      const afterSupports = activeGroup.movements.filter(m => m.type !== 'attack' && new Date(m.arrivalTime).getTime() > csTime);

      const lastClear = beforeAttacks.length > 0 ? beforeAttacks[beforeAttacks.length - 1] : null;
      const firstSupport = afterSupports.length > 0 ? afterSupports[0] : null;

      if (activeGroup.worldType === 'siege') {
        const gapStart = csTime;
        const gapEnd = firstSupport ? new Date(firstSupport.arrivalTime).getTime() : csTime + 60000;
        const returnTime = gapStart + 1000;
        
        gaps.push({
          id: `gap_after_${cs.id}`,
          desc: `Snipe Siege (Return 1s after CS from ${cs.attacker})`,
          gapStart, gapEnd, returnTime
        });
      } else {
        const gapEnd = csTime;
        const gapStart = lastClear ? new Date(lastClear.arrivalTime).getTime() : csTime - 60000;
        const returnTime = gapEnd - 1000;

        gaps.push({
          id: `gap_before_${cs.id}`,
          desc: `Snipe CS (Return 1s before CS from ${cs.attacker})`,
          gapStart, gapEnd, returnTime
        });
      }
    });

    return gaps;
  };

  const createPlanFromGap = (gap, minsAway) => {
    const returnTime = gap.returnTime;
    const sendTime = returnTime - (minsAway * 60 * 1000);
    
    if (sendTime < serverTime.getTime()) {
      alert("Cannot create a plan where Send Time is in the past! Choose a smaller minutes offset.");
      return;
    }

    const { recallTime } = calculateMidpointRecall(sendTime, returnTime);

    const newPlan = {
      id: Date.now().toString(),
      targetReturnTime: new Date(returnTime).toISOString(),
      sendTime: new Date(sendTime).toISOString(),
      recallTime: new Date(recallTime).toISOString(),
      gapDescription: gap.desc
    };

    const updatedGroups = groups.map(g => {
      if (g.id === activeGroup.id) {
        return { ...g, plans: [...g.plans, newPlan].sort((a,b) => new Date(a.sendTime).getTime() - new Date(b.sendTime).getTime()) };
      }
      return g;
    });
    setGroups(updatedGroups);
  };

  const deletePlan = (planId) => {
    const updatedGroups = groups.map(g => {
      if (g.id === activeGroup.id) {
        return { ...g, plans: g.plans.filter(p => p.id !== planId) };
      }
      return g;
    });
    setGroups(updatedGroups);
  };

  const savePlanToDatabase = async (plan) => {
    if (!activeGroup?.townId) {
      alert("Please ensure this city group has an associated Town ID to persist to the database.");
      return;
    }

    try {
      const res = await fetch('/api/snipe/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId: activeWorldId,
          label: `Recall Snipe: ${activeGroup.name}`,
          type: 'recall',
          worldType: activeGroup.worldType,
          targetTownId: activeGroup.townId,
          originTownId: activeGroup.townId,
          targetReturnTime: plan.targetReturnTime,
          sendTime: plan.sendTime,
          recallTime: plan.recallTime,
          notes: plan.gapDescription
        })
      });

      if (res.ok) {
        setSavedOpMsg('Operation saved to database!');
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

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded">
              World: {activeWorld?.name || activeWorldId.toUpperCase()} ({activeWorld?.worldType?.toUpperCase()})
            </span>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 border transition-colors ${
                audioEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
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
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Calibrated Server Time</div>
            <div className="text-xl font-mono font-bold text-primary mt-0.5">
              {serverTime.toLocaleTimeString([], { hour12: false })}
            </div>
          </div>
          <button 
            onClick={handleSyncTime}
            className="btn text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg border border-slate-700 flex items-center gap-1.5"
            title="Sync server clock offset"
          >
            <RefreshCw size={13} />
            <span>{serverOffset !== 0 ? `${serverOffset > 0 ? '+' : ''}${serverOffset}s` : 'Sync'}</span>
          </button>
        </div>
      </div>

      {savedOpMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fade-in font-mono">
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
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                g.id === activeGroupId 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <span>{g.name}</span>
              <span className="text-xs opacity-75 font-mono">({g.movements?.length || 0})</span>
            </button>
          ))}
        </div>

        {/* Add Group Form */}
        <form onSubmit={createGroup} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Target City Name..."
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-44"
          />
          <button type="submit" className="btn btn-primary text-xs py-1.5 px-3">
            <Plus size={14} /> Add City
          </button>
        </form>
      </div>

      {activeGroup ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Incoming Timeline & Sniper Plans */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Incoming Attacks & Supports Tracker */}
            <div className="glass-panel p-5 bg-slate-900/90 rounded-2xl">
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield size={18} className="text-amber-400" /> Incoming Attack & Support Queue
                </h2>
                <button
                  onClick={() => deleteGroup(activeGroup.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 size={13} /> Delete City
                </button>
              </div>

              {/* Add Movement Row */}
              <form onSubmit={addMovement} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <input
                    type="text"
                    placeholder="Attacker / Origin Town..."
                    value={movAttacker}
                    onChange={e => { setMovAttacker(e.target.value); searchTowns(e.target.value); }}
                    className="input-field py-1.5 px-2 text-xs"
                  />
                  {townSearchResults.length > 0 && (
                    <div className="absolute z-20 bg-slate-900 border border-slate-700 rounded-lg p-1 mt-1 max-h-36 overflow-y-auto w-64 shadow-xl">
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

                <div>
                  <select
                    value={movType}
                    onChange={e => setMovType(e.target.value)}
                    className="input-field py-1.5 px-2 text-xs font-semibold"
                  >
                    <option value="attack">Clear Attack</option>
                    <option value="cs">Colony Ship (CS)</option>
                    <option value="support">Support</option>
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="HH:MM:SS (e.g. 18:30:00)"
                    value={movTime}
                    onChange={e => setMovTime(e.target.value)}
                    className="input-field py-1.5 px-2 text-xs font-mono text-center"
                    required
                  />
                </div>

                <div>
                  <button type="submit" className="btn btn-primary text-xs py-1.5 w-full h-[34px]">
                    <Plus size={14} /> Add Movement
                  </button>
                </div>
              </form>

              {/* Movement List */}
              {activeGroup.movements.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activeGroup.movements.map(m => {
                    const isCs = m.type === 'cs';
                    const isSupport = m.type === 'support';
                    const arrTime = new Date(m.arrivalTime);
                    const diffMs = arrTime.getTime() - serverTime.getTime();

                    return (
                      <div
                        key={m.id}
                        className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                          isCs 
                            ? 'bg-rose-950/30 border-rose-600/50 shadow-md' 
                            : isSupport 
                            ? 'bg-blue-950/20 border-blue-800/40' 
                            : 'bg-slate-950/40 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            isCs ? 'bg-rose-500 text-white' : isSupport ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {m.type}
                          </span>
                          <div>
                            <span className="font-bold text-sm text-slate-200">{m.attacker}</span>
                            <div className="text-xs text-slate-400 font-mono">
                              Arrival: {arrTime.toLocaleTimeString([], { hour12: false })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-300">
                            in {formatCountdown(diffMs)}
                          </span>
                          <button
                            onClick={() => deleteMovement(m.id)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No incoming attacks logged for this city yet. Add movements above.
                </div>
              )}
            </div>

            {/* Calculated Snipe Gaps & Plan Generator */}
            {gaps.length > 0 && (
              <div className="glass-panel p-5 bg-slate-900/90 rounded-2xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <Target size={18} className="text-primary" /> Detected Recall Snipe Gaps
                </h2>
                <div className="flex flex-col gap-3">
                  {gaps.map(gap => (
                    <div key={gap.id} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-200 text-sm">{gap.desc}</div>
                        <div className="text-xs text-emerald-400 font-mono mt-0.5">
                          Target Landing Time: {new Date(gap.returnTime).toLocaleTimeString([], { hour12: false })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => createPlanFromGap(gap, 10)}
                          className="btn text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg border border-slate-700"
                        >
                          10m Delay
                        </button>
                        <button
                          onClick={() => createPlanFromGap(gap, 5)}
                          className="btn text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg border border-slate-700"
                        >
                          5m Delay
                        </button>
                        <button
                          onClick={() => createPlanFromGap(gap, 2)}
                          className="btn text-xs bg-primary/20 hover:bg-primary/30 text-primary py-1.5 px-3 rounded-lg border border-primary/40"
                        >
                          2m Delay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Execution Schedule */}
            {activeGroup.plans.length > 0 && (
              <div className="glass-panel p-5 bg-slate-900/90 rounded-2xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-emerald-400" /> Active Recall Execution Timers
                </h2>

                <div className="flex flex-col gap-3">
                  {activeGroup.plans.map((plan, idx) => {
                    const sendDate = new Date(plan.sendTime);
                    const recallDate = new Date(plan.recallTime);
                    const returnDate = new Date(plan.targetReturnTime);

                    const sendDiffMs = sendDate.getTime() - serverTime.getTime();
                    const recallDiffMs = recallDate.getTime() - serverTime.getTime();

                    const isSendUrgent = sendDiffMs >= 0 && sendDiffMs <= 10000;
                    const isRecallUrgent = recallDiffMs >= 0 && recallDiffMs <= 10000;

                    return (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isSendUrgent || isRecallUrgent 
                            ? 'bg-rose-950/40 border-rose-500 shadow-xl animate-pulse' 
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="font-bold text-accent text-sm">Plan #{idx + 1}: {plan.gapDescription}</span>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              Landing: {returnDate.toLocaleTimeString([], { hour12: false })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => savePlanToDatabase(plan)}
                              className="btn text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-2.5 rounded-lg border border-slate-700"
                              title="Save to database"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              onClick={() => deletePlan(plan.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Step 1: SEND ATTACK & Step 2: CANCEL ATTACK */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <div className={`p-3 rounded-lg border ${sendDiffMs < 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/80 border-slate-700'}`}>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 1: Send Attack</div>
                            <div className="text-base font-mono font-bold text-amber-400 mt-0.5">
                              {sendDate.toLocaleTimeString([], { hour12: false })}
                            </div>
                            <div className="text-xs font-mono text-slate-300 mt-1">
                              {sendDiffMs < 0 ? '✓ Sent' : `in ${formatCountdown(sendDiffMs)}`}
                            </div>
                          </div>

                          <div className={`p-3 rounded-lg border ${recallDiffMs < 0 ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/80 border-primary/40'}`}>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 2: CANCEL / RECALL Attack</div>
                            <div className="text-base font-mono font-bold text-rose-400 mt-0.5">
                              {recallDate.toLocaleTimeString([], { hour12: false })}
                            </div>
                            <div className="text-xs font-mono text-emerald-400 mt-1">
                              {recallDiffMs < 0 ? '✓ Recalled' : `in ${formatCountdown(recallDiffMs)}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Dummy Target Finder & Guidelines */}
          <div className="flex flex-col gap-4">
            <DummyFinder 
              originTownId={activeGroup.townId} 
              durationSeconds={600} 
              worldSpeed={activeWorld?.speed || 2}
              worldId={activeWorldId}
            />

            <div className="glass-panel p-4 bg-slate-900/60 rounded-xl text-xs text-slate-400 leading-relaxed">
              <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Shield size={14} className="text-primary" /> Why Midpoint Recall Works
              </h3>
              <p className="mb-2">
                When you launch an attack, the Grepolis server applies random anti-timing rule (ATR) variance (±10s).
              </p>
              <p className="mb-2">
                However, when you <strong>cancel</strong> an outbound command, the return travel time is calculated with <strong>zero ATR variance</strong> — the return journey matches the outbound elapsed time to the exact millisecond.
              </p>
              <p>
                By canceling at the precise mathematical midpoint, your troops will return home exactly when you planned, guaranteeing a snipe with sub-second accuracy.
              </p>
            </div>
          </div>

        </div>
      ) : (
        <div className="glass-panel text-center py-12">
          <p className="text-slate-400 text-sm mb-3">No city groups created yet for this world.</p>
          <p className="text-xs text-slate-500">Create a city group using the input above to begin tracking incoming attacks.</p>
        </div>
      )}

    </div>
  );
}
