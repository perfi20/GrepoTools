'use client';
import React, { useState, useEffect } from 'react';

export default function Countdown({ targetMs, format, className = '', style = {}, prefix = '', suffix = '' }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = targetMs - now;

  return (
    <span className={className} style={style}>
      {prefix}
      {format ? format(remainingMs) : remainingMs}
      {suffix}
    </span>
  );
}
