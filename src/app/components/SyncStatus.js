"use client";

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetch('/api/world/status')
      .then(res => res.json())
      .then(data => {
        if (data.lastSync) setStatus(new Date(data.lastSync));
      })
      .catch(console.error);

    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const minutesAgo = Math.floor((now - status) / 1000 / 60);
  
  // Calculate next 10-minute interval check
  const nowMinutes = now.getMinutes();
  const nextSyncIn = 10 - (nowMinutes % 10);
  
  const timeString = status.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '999px', marginLeft: '16px' }}>
      <Clock size={12} color="#a855f7" />
      <span>Synced at {timeString}</span>
      <span style={{ opacity: 0.5 }}>•</span>
      <span>Next sync try in ~{nextSyncIn}m</span>
    </div>
  );
}
