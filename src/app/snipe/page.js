'use client';
import { useState, useEffect } from 'react';

export default function SnipeTimerPage() {
  const [targetTime, setTargetTime] = useState('');
  const [travelTime, setTravelTime] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('attack');
  const [serverOffset, setServerOffset] = useState(0); // in seconds
  
  const [queue, setQueue] = useState([]);
  const [now, setNow] = useState(new Date());

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('grepo-operations-queue');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Revive date objects
        const revived = parsed.map(op => ({
          ...op,
          windowStart: new Date(op.windowStart),
          windowEnd: new Date(op.windowEnd),
          targetDate: new Date(op.targetDate)
        }));
        setQueue(revived);
      } catch (e) {
        console.error("Failed to parse queue", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('grepo-operations-queue', JSON.stringify(queue));
  }, [queue]);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addToQueue = (e) => {
    e.preventDefault();
    if (!targetTime || !travelTime) return;

    const [tH, tM, tS] = targetTime.split(':').map(Number);
    const [trH, trM, trS] = travelTime.split(':').map(Number);

    const targetDate = new Date();
    targetDate.setHours(tH, tM, tS, 0);
    
    // If target is in the past (e.g. earlier today), assume tomorrow
    if (targetDate.getTime() < new Date().getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const travelMs = (trH * 3600 + trM * 60 + trS) * 1000;
    
    const idealLaunchDate = new Date(targetDate.getTime() - travelMs);
    const windowStart = new Date(idealLaunchDate.getTime() - 10000);
    const windowEnd = new Date(idealLaunchDate.getTime() + 10000);

    const newOp = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      label: label || 'Unnamed Operation',
      type,
      targetDate,
      windowStart,
      windowEnd,
    };

    setQueue([...queue, newOp].sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime()));
    
    // Clear the form fields after successful submit so the user knows they need to enter new data
    setLabel('');
    setTargetTime('');
    setTravelTime('');
  };

  const removeOp = (id) => {
    setQueue(queue.filter(op => op.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const serverTime = new Date(now.getTime() + (serverOffset * 1000));

  const formatCountdown = (ms) => {
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
      {/* CSS for flashing animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flashWarning {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; color: var(--danger); }
        }
        .flashing {
          animation: flashWarning 1s infinite;
        }
      `}} />

      <div className="glass-panel text-center">
        <h1 className="gradient-text">Operations Queue</h1>
        <p className="text-secondary">Plan your attacks and support timings. Countdowns track the 20-second launch window.</p>
        <div className="mt-4 flex justify-center gap-4">
          <a href="/snipe/recall" className="btn btn-primary" style={{ background: 'var(--accent)' }}>Go to Army Recall Sniper</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel">
          <h2>Add Operation</h2>
          <form onSubmit={addToQueue} className="grid gap-4 mt-4">
            <div>
              <label className="text-sm text-secondary block mb-2">Operation Label</label>
              <input 
                type="text" 
                placeholder="e.g. CS Nuke to City A"
                className="input-field" 
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-secondary block mb-2">Target Time (HH:MM:SS)</label>
                <input 
                  type="time" 
                  step="1"
                  className="input-field" 
                  value={targetTime}
                  onChange={e => setTargetTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-secondary block mb-2">Travel Time (HH:MM:SS)</label>
                <input 
                  type="text" 
                  pattern="^\d+:\d{2}:\d{2}$"
                  placeholder="e.g. 45:15:00"
                  className="input-field"
                  value={travelTime}
                  onChange={e => setTravelTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-secondary block mb-2">Operation Type</label>
              <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
                <option value="attack">Attack</option>
                <option value="support">Support</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary mt-2">Add to Queue</button>
          </form>
        </div>

        <div className="glass-panel">
          <h2>Settings</h2>
          <div className="mt-4">
            <label className="text-sm text-secondary block mb-2">Server Time Offset (seconds)</label>
            <input 
              type="number" 
              className="input-field mb-2" 
              value={serverOffset}
              onChange={e => setServerOffset(Number(e.target.value))}
            />
            <p className="text-xs text-secondary">
              If the game server clock is 3 seconds ahead of your PC clock, enter 3. 
            </p>
          </div>
          
          <div className="mt-4 p-4 text-center" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div className="text-sm text-secondary">Current Adjusted Server Time</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>
              {serverTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel mt-4">
        <div className="flex justify-between items-center">
          <h2>Active Queue</h2>
          {queue.length > 0 && (
            <button onClick={clearQueue} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>Clear Queue</button>
          )}
        </div>
        
        {queue.length === 0 ? (
          <p className="text-secondary mt-4">No operations planned. Add one above.</p>
        ) : (
          <div className="grid gap-4 mt-4">
            {queue.map(op => {
              const msUntilStart = op.windowStart.getTime() - serverTime.getTime();
              const msUntilEnd = op.windowEnd.getTime() - serverTime.getTime();
              
              let status = '';
              let statusColor = '';
              let countdown = '';
              let isFlashing = false;

              if (msUntilStart > 60000) {
                status = 'WAITING';
                statusColor = 'var(--text-secondary)';
                countdown = `Window opens in ${formatCountdown(msUntilStart)}`;
              } else if (msUntilStart > 10000) {
                status = 'READY (1 MINUTE)';
                statusColor = 'var(--accent)';
                countdown = `Window opens in ${formatCountdown(msUntilStart)}`;
              } else if (msUntilStart > 0) {
                status = 'GET READY!';
                statusColor = 'var(--accent)';
                countdown = `Window opens in ${formatCountdown(msUntilStart)}`;
                isFlashing = true;
              } else if (msUntilEnd > 0) {
                status = 'ACTION WINDOW';
                statusColor = 'var(--success)';
                countdown = `${formatCountdown(msUntilEnd)} remaining to launch!`;
                isFlashing = true;
              } else {
                status = 'PASSED';
                statusColor = 'var(--danger)';
                countdown = 'Window closed.';
              }

              return (
                <div key={op.id} className="p-4 flex items-center justify-between" style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', borderLeft: `4px solid ${op.type === 'attack' ? 'var(--danger)' : 'var(--primary)'}` }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{op.label}</h3>
                    <div className="flex gap-4 mt-2 text-sm text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span>Target: <strong style={{ color: 'var(--text-primary)' }}>{op.targetDate.toLocaleTimeString('en-US', { hour12: false })}</strong></span>
                      <span>Window: <strong style={{ color: 'var(--text-primary)' }}>{op.windowStart.toLocaleTimeString('en-US', { hour12: false })}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{op.windowEnd.toLocaleTimeString('en-US', { hour12: false })}</strong></span>
                    </div>
                  </div>
                  <div className="text-right" style={{ width: '220px' }}>
                    <div className={isFlashing ? 'flashing' : ''} style={{ color: statusColor, fontWeight: 'bold', fontSize: '1.2rem', transition: 'color 0.2s' }}>{status}</div>
                    <div className="text-sm mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{countdown}</div>
                    <button onClick={() => removeOp(op.id)} className="text-xs text-secondary mt-2" style={{ background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
