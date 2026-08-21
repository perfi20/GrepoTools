'use client';
import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export default function SnipeQueueItem({ op, onRemove, serverOffset }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const msUntilStart = op.windowStart.getTime() - serverTime.getTime();
  const msUntilEnd = op.windowEnd.getTime() - serverTime.getTime();
  const inWindow = msUntilStart <= 0 && msUntilEnd >= 0;
  const passed = msUntilEnd < 0;

  return (
    <div 
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
          onClick={() => onRemove(op.id)}
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
}
