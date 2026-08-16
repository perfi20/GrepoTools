'use client';
import React, { useState } from 'react';

const buildingBasePop = {
  main: { base: 1.17, factor: 1.25 },
  temple: { base: 5.00, factor: 1.12 },
  market: { base: 2.00, factor: 1.15 },
  wall: { base: 2.00, factor: 1.20 },
  barracks: { base: 1.50, factor: 1.18 },
  docks: { base: 2.00, factor: 1.18 },
  lumber: { base: 1.00, factor: 1.15 },
  stoner: { base: 1.00, factor: 1.15 },
  ironer: { base: 1.00, factor: 1.15 },
  academy: { base: 2.00, factor: 1.18 }
};

export function getBuildingPopulation(buildingId, level) {
  if (level <= 0) return 0;
  const config = buildingBasePop[buildingId];
  if (!config) return 0;
  let pop = 0;
  for (let i = 1; i <= level; i++) {
    pop += Math.round(config.base * Math.pow(config.factor, i - 1));
  }
  return pop;
}

export default function DemolitionSimulator({ currentLevels }) {
  const targetLevelsPreset = {
    main: 15,
    temple: 1,
    market: 10,
    wall: 0,
    barracks: 10,
    docks: 15,
    lumber: 25,
    stoner: 20,
    ironer: 25,
    academy: 30
  };

  const [targets, setTargets] = useState(targetLevelsPreset);

  const calculateTotalSaved = () => {
    let saved = 0;
    Object.keys(buildingBasePop).forEach(bId => {
      const currentVal = currentLevels?.[bId] || 0;
      const targetVal = targets[bId] || 0;
      if (currentVal > targetVal) {
        saved += (getBuildingPopulation(bId, currentVal) - getBuildingPopulation(bId, targetVal));
      }
    });
    return saved;
  };

  const populationSaved = calculateTotalSaved();
  const additionalLightShips = Math.floor(populationSaved / 8);
  const additionalSlingers = populationSaved;

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md">
      <h3 className="text-lg font-bold text-accent mb-4">Building Demolition Simulator</h3>
      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        {Object.keys(buildingBasePop).map(bId => (
          <div key={bId} className="flex justify-between items-center bg-slate-950/40 p-2 rounded">
            <span className="capitalize font-medium text-slate-300">{bId}:</span>
            <div className="flex items-center gap-2">
              <span className="text-secondary text-xs">Cur: {currentLevels?.[bId] || 0}</span>
              <input
                type="number"
                value={targets[bId]}
                onChange={e => setTargets({...targets, [bId]: Math.max(0, parseInt(e.target.value) || 0)})}
                className="w-12 text-center bg-slate-900 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-slate-950/60 rounded-lg text-center">
        <div className="text-xs text-secondary uppercase tracking-wider">Population Reclaimed</div>
        <div className="text-3xl font-mono text-green-400 font-bold mt-1">+{populationSaved}</div>
        <div className="text-xs text-slate-400 mt-2">
          Equivalent to: <span className="text-accent font-bold">+{additionalLightShips} Light Ships</span> or <span className="text-accent font-bold">+{additionalSlingers} Slingers</span>
        </div>
      </div>
    </div>
  );
}
