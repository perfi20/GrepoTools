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
  const nextSyncIn = Math.max(0, 60 - (now.getMinutes() + (now.getSeconds() > 0 ? 1 : 0))); // Rough estimate for hourly cron

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '999px', marginLeft: '16px' }}>
      <Clock size={12} color="#a855f7" />
      <span>Synced {minutesAgo}m ago</span>
      <span style={{ opacity: 0.5 }}>•</span>
      <span>Next in ~{nextSyncIn}m</span>
    </div>
  );
}
