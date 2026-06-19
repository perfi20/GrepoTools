'use client';
import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertTriangle, Crosshair, Shield, Clock } from 'lucide-react';

export default function RecallSnipePage() {
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [serverOffset, setServerOffset] = useState(0); // in seconds
  const [now, setNow] = useState(new Date());

  // Input states for new group
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupWorld, setNewGroupWorld] = useState('siege');
  const [masterPlayer, setMasterPlayer] = useState(null);

  useEffect(() => {
    fetch('/api/master-player')
      .then(r => r.json())
      .then(d => { if(d.player) setMasterPlayer(d.player); })
      .catch(() => {});
  }, []);

  // Input states for new movement
  const [movAttacker, setMovAttacker] = useState('');
  const [movAttackerId, setMovAttackerId] = useState(null);
  const [movType, setMovType] = useState('attack');
  const [movTime, setMovTime] = useState('');
  const [townSearchResults, setTownSearchResults] = useState([]);

  const searchTowns = async (q) => {
    if (q.length < 2) {
      setTownSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/world/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setTownSearchResults(data.towns || []);
    } catch (e) {}
  };

  // State for custom gap minutes input
  const [customMins, setCustomMins] = useState({});

  // Intel states
  const [intelData, setIntelData] = useState({});
  const [intelLoading, setIntelLoading] = useState({});

  const fetchIntel = async (movId, attackerId) => {
    if (!attackerId) {
      alert("No town ID associated with this attacker. Please use the dropdown to select a valid town.");
      return;
    }
    
    if (intelData[movId]) {
      const newIntel = { ...intelData };
      delete newIntel[movId];
      setIntelData(newIntel);
      return;
    }

    setIntelLoading({ ...intelLoading, [movId]: true });
    try {
      const res = await fetch(`/api/intel/town?town_id=${attackerId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIntelData({ ...intelData, [movId]: data });
    } catch (e) {
      alert("Failed to fetch intel: " + e.message);
    } finally {
      setIntelLoading({ ...intelLoading, [movId]: false });
    }
  };

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('grepo-recall-groups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGroups(parsed);
        if (parsed.length > 0) setActiveGroupId(parsed[0].id);
      } catch (e) {
        console.error("Failed to parse queue", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('grepo-recall-groups', JSON.stringify(groups));
  }, [groups]);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const serverTime = new Date(now.getTime() + (serverOffset * 1000));

  const createGroup = (e) => {
    e.preventDefault();
    if (!newGroupName) return;
    const newGroup = {
      id: Date.now().toString(),
      name: newGroupName,
      worldType: newGroupWorld,
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
    
    // If target is in the past, assume tomorrow
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

  // Logic to find gaps and calculate potential return times
  const calculateGaps = () => {
    if (!activeGroup || activeGroup.movements.length === 0) return [];
    
    const csMovements = activeGroup.movements.filter(m => m.type === 'cs');
    const gaps = [];

    // For each CS, we find the clear attack right before it, and support right after it
    csMovements.forEach(cs => {
      const csTime = new Date(cs.arrivalTime).getTime();
      
      const beforeAttacks = activeGroup.movements.filter(m => m.type === 'attack' && new Date(m.arrivalTime).getTime() < csTime);
      const afterSupports = activeGroup.movements.filter(m => m.type !== 'attack' && new Date(m.arrivalTime).getTime() > csTime); // Including other CS? Just anything after.

      const lastClear = beforeAttacks.length > 0 ? beforeAttacks[beforeAttacks.length - 1] : null;
      const firstSupport = afterSupports.length > 0 ? afterSupports[0] : null;

      if (activeGroup.worldType === 'siege') {
        // In Siege, we want to recall ATTACKS to land AFTER the CS, but BEFORE the first support.
        const gapStart = csTime;
        const gapEnd = firstSupport ? new Date(firstSupport.arrivalTime).getTime() : csTime + 60000; // 1 min buffer if no support
        
        // Return 1s after CS lands
        const returnTime = gapStart + 1000;
        
        gaps.push({
          id: `gap_after_${cs.id}`,
          desc: `Snipe Siege (After CS from ${cs.attacker})`,
          gapStart, gapEnd, returnTime
        });

      } else {
        // In Revolt, we want to recall DEFENSE to land BEFORE the CS, but AFTER the last clear.
        const gapEnd = csTime;
        const gapStart = lastClear ? new Date(lastClear.arrivalTime).getTime() : csTime - 60000;
        
        // Return 1s before CS lands
        const returnTime = gapEnd - 1000;

        gaps.push({
          id: `gap_before_${cs.id}`,
          desc: `Snipe CS (Before CS from ${cs.attacker})`,
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
      alert("Cannot create a plan where the Send Time is in the past! Please choose a smaller minute value.");
      return;
    }

    // Recall time is exactly halfway between send and return
    const recallTime = sendTime + ((returnTime - sendTime) / 2);

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

  const formatCountdown = (ms) => {
    if (ms < 0) return '0s';
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
    <div className="grid gap-4" style={{ marginTop: '2rem' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseRed {
          0%, 100% { box-shadow: 0 0 0px 0px rgba(239, 68, 68, 0); }
          50% { box-shadow: 0 0 10px 2px rgba(239, 68, 68, 0.6); }
        }
        .cs-row {
          background: rgba(239, 68, 68, 0.2) !important;
          border-left: 4px solid var(--danger) !important;
          animation: pulseRed 2s infinite;
        }
        .action-urgent {
          animation: pulseRed 1s infinite;
          background: rgba(239, 68, 68, 0.15);
        }
        .action-ready {
          background: rgba(234, 179, 8, 0.15);
        }
        .action-done {
          opacity: 0.5;
        }
      `}} />

      <div className="glass-panel text-center">
        <h1 className="gradient-text">Army Recall Sniper</h1>
        <p className="text-secondary">Plan exact defensive or offensive snipes using the 10-minute recall rule.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel col-span-1">
          <h2>Action Groups (Sieges)</h2>
          <div className="mt-4 flex flex-col gap-2">
            {groups.map(g => (
              <div 
                key={g.id} 
                className={`p-3 rounded cursor-pointer flex justify-between items-center transition-all ${activeGroupId === g.id ? 'bg-[rgba(255,255,255,0.1)] border-l-4 border-primary' : 'bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.05)]'}`}
                onClick={() => setActiveGroupId(g.id)}
              >
                <div>
                  <div className="font-bold">{g.name}</div>
                  <div className="text-xs text-secondary flex items-center gap-1 mt-1">
                    {g.worldType === 'siege' ? <Crosshair size={12}/> : <Shield size={12}/>}
                    {g.worldType === 'siege' ? 'Siege (Snipe After)' : 'Revolt (Snipe Before)'}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} className="text-secondary hover:text-danger" style={{ background: 'transparent', border: 'none' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={createGroup} className="mt-6 border-t border-[rgba(255,255,255,0.1)] pt-4">
            <h3 className="text-sm mb-3">Create New Group</h3>
            {masterPlayer?.townsList?.length > 0 ? (
              <select 
                className="input-field mb-2" 
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              >
                <option value="">Select Target City...</option>
                {masterPlayer.townsList.map(t => (
                  <option key={t.id} value={t.name}>{t.name} ({t.points} pts)</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                placeholder="Target City / Player" 
                className="input-field mb-2" 
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
            )}
            <select className="input-field mb-2" value={newGroupWorld} onChange={e => setNewGroupWorld(e.target.value)}>
              <option value="siege">Siege / Conquest</option>
              <option value="revolt">Revolt</option>
            </select>
            <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={16} /> Add Group
            </button>
          </form>

          <div className="mt-8 border-t border-[rgba(255,255,255,0.1)] pt-4">
            <label className="text-sm text-secondary block mb-2">Server Time Offset (sec)</label>
            <input 
              type="number" 
              className="input-field" 
              value={serverOffset}
              onChange={e => setServerOffset(Number(e.target.value))}
            />
            <div className="mt-4 p-3 text-center bg-[rgba(0,0,0,0.2)] rounded font-tabular-nums text-xl font-bold">
              {serverTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-4">
          {activeGroup ? (
            <>
              {/* Incoming Movements */}
              <div className="glass-panel">
                <h2>Incoming Movements for {activeGroup.name}</h2>
                <form onSubmit={addMovement} className="grid grid-cols-4 gap-2 mt-4 items-end">
                  <div className="relative">
                    <label className="text-xs text-secondary">Attacker Town</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Search Town..." 
                      value={movAttacker} 
                      onChange={e => {
                        setMovAttacker(e.target.value);
                        searchTowns(e.target.value);
                      }} 
                    />
                    {townSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded mt-1 z-10 max-h-48 overflow-y-auto">
                        {townSearchResults.map(t => (
                          <div key={t.id} className="p-2 hover:bg-[rgba(255,255,255,0.1)] cursor-pointer text-sm" onClick={() => {
                            setMovAttacker(t.name);
                            setMovAttackerId(t.id);
                            setTownSearchResults([]);
                          }}>
                            {t.name} <span className="text-secondary">({t.points} pts)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-secondary">Type</label>
                    <select className="input-field" value={movType} onChange={e => setMovType(e.target.value)}>
                      <option value="attack">Clear Attack</option>
                      <option value="cs">Colony Ship</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-secondary">Arrival (HH:MM:SS)</label>
                    <input type="time" step="1" className="input-field" value={movTime} onChange={e => setMovTime(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary h-[42px]">Add</button>
                </form>

                <div className="mt-6 flex flex-col gap-2">
                  {activeGroup.movements.map((mov, idx) => {
                    const arrTime = new Date(mov.arrivalTime);
                    const msUntil = arrTime.getTime() - serverTime.getTime();
                    const isPassed = msUntil < 0;

                    return (
                      <div key={mov.id} className="flex flex-col gap-1">
                        <div className={`flex justify-between items-center p-3 rounded bg-[rgba(0,0,0,0.2)] border-l-4 ${mov.type === 'cs' ? 'cs-row' : mov.type === 'attack' ? 'border-danger' : 'border-success'} ${isPassed ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-lg">{arrTime.toLocaleTimeString('en-US', { hour12: false })}</span>
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                {mov.attacker || 'Unknown'}
                                {mov.attacker && mov.attacker !== 'Unknown' && (
                                  <button type="button" onClick={() => fetchIntel(mov.id, mov.attackerId)} className="text-xs bg-primary px-2 py-0.5 rounded text-white hover:bg-opacity-80">
                                    {intelLoading[mov.id] ? 'Loading...' : intelData[mov.id] ? 'Hide Intel' : 'Intel'}
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-secondary uppercase tracking-wider">{mov.type === 'cs' ? 'COLONY SHIP' : mov.type}</div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            {!isPassed && <span className="font-mono text-accent">{formatCountdown(msUntil)}</span>}
                            {isPassed && <span className="text-secondary text-sm">Landed</span>}
                            <button onClick={() => deleteMovement(mov.id)} className="text-secondary hover:text-danger" style={{ background: 'transparent', border: 'none' }}><Trash2 size={16}/></button>
                          </div>
                        </div>
                        {intelData[mov.id] && (
                          <div className="ml-4 p-3 bg-[rgba(255,255,255,0.05)] rounded text-sm text-secondary border-l border-primary">
                            <div className="font-bold text-white mb-2">Town Intel</div>
                            {intelData[mov.id].intel && intelData[mov.id].intel.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {intelData[mov.id].intel.slice(0, 5).map((record, i) => (
                                  <div key={i} className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-1">
                                    <span>{record.date} - <strong className="text-white">{record.type}</strong></span>
                                    <span>{record.units.map(u => `${u.count} ${u.name}`).join(', ')}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div>No intel found for this town.</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeGroup.movements.length === 0 && <p className="text-secondary text-center py-4">No incoming movements added.</p>}
                </div>
              </div>

              {/* Snipe Calculator & Plans */}
              <div className="glass-panel">
                <h2>Snipe Plans</h2>
                
                {/* Available Gaps */}
                {activeGroup.movements.filter(m => m.type === 'cs').length > 0 && (
                  <div className="mt-4 mb-6 p-4 border border-[rgba(255,255,255,0.1)] rounded bg-[rgba(0,0,0,0.1)]">
                    <h3 className="text-sm text-secondary mb-3">Available CS Gaps</h3>
                    <div className="flex flex-col gap-2">
                      {calculateGaps().map(gap => (
                        <div key={gap.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-accent" />
                            <span>{gap.desc}</span>
                            <span className="font-mono text-sm bg-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded ml-2">Target Return: {new Date(gap.returnTime).toLocaleTimeString('en-US', { hour12: false })}</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="number" 
                              min="1" 
                              max="20" 
                              className="input-field text-center" 
                              style={{ width: '60px', padding: '0.25rem', height: 'auto', minHeight: '30px' }}
                              value={customMins[gap.id] || 5} 
                              onChange={e => setCustomMins({...customMins, [gap.id]: Number(e.target.value)})}
                            />
                            <span className="text-xs text-secondary mr-2">mins</span>
                            <button onClick={() => createPlanFromGap(gap, customMins[gap.id] || 5)} className="btn btn-sm text-xs bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)]">Create Plan</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Plans */}
                <div className="flex flex-col gap-4">
                  {activeGroup.plans.map(plan => {
                    const sendDate = new Date(plan.sendTime);
                    const recallDate = new Date(plan.recallTime);
                    const returnDate = new Date(plan.targetReturnTime);
                    
                    const msToSend = sendDate.getTime() - serverTime.getTime();
                    const msToRecall = recallDate.getTime() - serverTime.getTime();
                    const isSendPassed = msToSend < 0;
                    const isRecallPassed = msToRecall < 0;

                    let sendClass = isSendPassed ? 'action-done' : (msToSend < 60000 ? 'action-urgent' : 'action-ready');
                    let recallClass = isRecallPassed ? 'action-done' : (isSendPassed && msToRecall < 60000 ? 'action-urgent' : (isSendPassed ? 'action-ready' : 'opacity-50'));

                    return (
                      <div key={plan.id} className="border border-[rgba(255,255,255,0.1)] rounded overflow-hidden">
                        <div className="bg-[rgba(0,0,0,0.3)] p-2 px-4 flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.05)]">
                          <span className="font-bold">{plan.gapDescription}</span>
                          <div className="flex items-center gap-4">
                            <span>Return: <strong className="font-mono">{returnDate.toLocaleTimeString('en-US', { hour12: false })}</strong></span>
                            <button onClick={() => deletePlan(plan.id)} className="text-secondary hover:text-danger" style={{ background: 'transparent', border: 'none' }}><Trash2 size={14}/></button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 divide-x divide-[rgba(255,255,255,0.05)]">
                          {/* SEND ACTION */}
                          <div className={`p-4 ${sendClass}`}>
                            <div className="text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
                              <span className="font-bold">1. Send Troops</span>
                              {!isSendPassed && <span className="font-mono">{formatCountdown(msToSend)}</span>}
                              {isSendPassed && <span className="text-success">Sent ✓</span>}
                            </div>
                            <div className="font-mono text-2xl font-bold">{sendDate.toLocaleTimeString('en-US', { hour12: false })}</div>
                            <div className="text-xs text-secondary mt-1">Send to any target far enough</div>
                          </div>

                          {/* RECALL ACTION */}
                          <div className={`p-4 ${recallClass}`}>
                            <div className="text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
                              <span className="font-bold">2. Click Cancel</span>
                              {!isRecallPassed && !isSendPassed && <span className="text-secondary">Waiting to send</span>}
                              {!isRecallPassed && isSendPassed && <span className="font-mono font-bold text-accent">{formatCountdown(msToRecall)}</span>}
                              {isRecallPassed && <span className="text-success">Recalled ✓</span>}
                            </div>
                            <div className="font-mono text-2xl font-bold">{recallDate.toLocaleTimeString('en-US', { hour12: false })}</div>
                            <div className="text-xs text-secondary mt-1">Exact second to cancel movement</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {activeGroup.plans.length === 0 && <p className="text-secondary text-center py-4">No snipe plans created yet.</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel flex items-center justify-center h-full text-secondary min-h-[300px]">
              Select or create an action group to begin planning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
