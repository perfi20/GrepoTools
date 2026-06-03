'use client';
import { useState } from 'react';

export default function PlannerPage() {
  return (
    <div className="grid gap-4" style={{ marginTop: '2rem' }}>
      <div className="glass-panel text-center">
        <h1 className="gradient-text">City & Army Planner</h1>
        <p className="text-secondary">Plan your optimal nukes and defensive compositions.</p>
      </div>
      <div className="glass-panel text-center p-12">
        <h3 className="text-secondary">Coming Soon!</h3>
        <p className="text-sm mt-4">We will integrate the official units.json data here to help you simulate optimal population usage.</p>
      </div>
    </div>
  );
}
