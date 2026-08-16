'use client';
import React, { useState } from 'react';
import { Sparkles, Swords, Shield, RotateCcw } from 'lucide-react';

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

const presets = {
  offense: {
    label: "Optimal Offense (Wall 0, Min Pop)",
    targets: { main: 15, temple: 1, market: 10, wall: 0, barracks: 10, docks: 15, lumber: 25, stoner: 20, ironer: 25, academy: 30 }
  },
  defense: {
    label: "Optimal Defense (Wall 25, Tower)",
    targets: { main: 20, temple: 5, market: 10, wall: 25, barracks: 20, docks: 20, lumber: 25, stoner: 25, ironer: 25, academy: 30 }
  },
  maxFarm: {
    label: "Max Population Stripping (Extreme)",
    targets: { main: 10, temple: 1, market: 4, wall: 0, barracks: 5, docks: 10, lumber: 20, stoner: 20, ironer: 20, academy: 28 }
  }
};

export default function DemolitionSimulator({ currentLevels }) {
  const [targets, setTargets] = useState(presets.offense.targets);

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
  const additionalBiremes = Math.floor(populationSaved / 8);
  const additionalSlingers = populationSaved;
  const additionalHoplites = populationSaved;

  return (
    <div className="glass-panel p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" /> Building Demolition Simulator
          </h3>
          <p className="text-[11px] text-slate-400">Reclaim farm population by downsizing unnecessary building levels</p>
        </div>

        {/* Preset Selector */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTargets(presets.offense.targets)}
            className="text-[11px] px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-semibold transition-colors"
          >
            Offense (Wall 0)
          </button>
          <button
            type="button"
            onClick={() => setTargets(presets.defense.targets)}
            className="text-[11px] px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 font-semibold transition-colors"
          >
            Defense (Wall 25)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-5">
        {Object.keys(buildingBasePop).map(bId => {
          const cur = currentLevels?.[bId] || 0;
          const tgt = targets[bId] || 0;
          const diff = cur - tgt;

          return (
            <div key={bId} className="flex justify-between items-center bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
              <span className="capitalize font-medium text-slate-300">{bId}:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono text-[11px]">Cur: {cur}</span>
                <span className="text-slate-500">→</span>
                <input
                  type="number"
                  min="0"
                  max="45"
                  value={targets[bId]}
                  onChange={e => setTargets({...targets, [bId]: Math.max(0, parseInt(e.target.value) || 0)})}
                  className="w-12 text-center bg-slate-950 border border-slate-700/80 rounded py-0.5 font-mono font-bold text-white text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Total Farm Population Reclaimed
        </div>
        <div className="text-3xl font-mono text-emerald-400 font-bold mt-1">
          +{populationSaved.toLocaleString()} Pop
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-left">
            <div className="text-[10px] text-slate-400 uppercase">Naval Equivalent</div>
            <div className="font-bold text-rose-400 font-mono text-sm mt-0.5">
              +{additionalLightShips} Light Ships <span className="text-slate-400 text-xs font-normal">or</span> +{additionalBiremes} Biremes
            </div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-left">
            <div className="text-[10px] text-slate-400 uppercase">Land Equivalent</div>
            <div className="font-bold text-amber-400 font-mono text-sm mt-0.5">
              +{additionalSlingers} Slingers <span className="text-slate-400 text-xs font-normal">or</span> +{additionalHoplites} Hoplites
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
