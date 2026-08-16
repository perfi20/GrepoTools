'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);

export function AppContextProvider({ children }) {
  const [worlds, setWorlds] = useState([]);
  const [activeWorldId, setActiveWorldId] = useState('hu119');
  const [activeWorld, setActiveWorld] = useState(null);
  const [activePlayerName, setActivePlayerName] = useState('');
  const [activePlayer, setActivePlayer] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [loadingWorlds, setLoadingWorlds] = useState(true);
  const [loadingPlayer, setLoadingPlayer] = useState(true);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    try {
      const savedWorld = localStorage.getItem('grepo_active_world');
      if (savedWorld) setActiveWorldId(savedWorld.toLowerCase());

      const savedPlayer = localStorage.getItem('grepo_active_player');
      if (savedPlayer) setActivePlayerName(savedPlayer);
    } catch (e) {}
  }, []);

  // 2. Fetch Worlds list
  const refreshWorlds = useCallback(async () => {
    try {
      setLoadingWorlds(true);
      const res = await fetch('/api/worlds');
      const data = await res.json();
      if (data.success && Array.isArray(data.worlds)) {
        setWorlds(data.worlds);
        // Find or fallback active world
        const current = data.worlds.find(w => w.id === activeWorldId) || data.worlds[0];
        if (current) {
          setActiveWorld(current);
          setActiveWorldId(current.id);
        }
      }
    } catch (e) {
      console.error("Failed to load worlds:", e);
    } finally {
      setLoadingWorlds(false);
    }
  }, [activeWorldId]);

  useEffect(() => {
    refreshWorlds();
  }, [refreshWorlds]);

  // 3. Switch World
  const switchWorld = useCallback((worldId) => {
    const cleanId = worldId.toLowerCase();
    setActiveWorldId(cleanId);
    try {
      localStorage.setItem('grepo_active_world', cleanId);
    } catch (e) {}

    const found = worlds.find(w => w.id === cleanId);
    if (found) setActiveWorld(found);
  }, [worlds]);

  // 4. Fetch Master Player Data
  const refreshActivePlayer = useCallback(async () => {
    if (!activeWorldId) return;
    try {
      setLoadingPlayer(true);
      const params = new URLSearchParams({ world: activeWorldId });
      if (activePlayerName) params.append('playerName', activePlayerName);

      const res = await fetch(`/api/master-player?${params.toString()}`);
      const data = await res.json();

      if (data && data.player) {
        setActivePlayer(data.player);
        setActivePlayerName(data.player.name);
        setMasterData(data);
      } else {
        setActivePlayer(null);
        setMasterData(null);
      }
    } catch (e) {
      console.error("Failed to fetch active player:", e);
      setActivePlayer(null);
    } finally {
      setLoadingPlayer(false);
    }
  }, [activeWorldId, activePlayerName]);

  useEffect(() => {
    refreshActivePlayer();
  }, [refreshActivePlayer]);

  // 5. Switch Player
  const switchPlayer = useCallback((name) => {
    setActivePlayerName(name);
    try {
      localStorage.setItem('grepo_active_player', name);
    } catch (e) {}
  }, []);

  return (
    <AppContext.Provider value={{
      worlds,
      activeWorldId,
      activeWorld: activeWorld || { id: activeWorldId, name: activeWorldId.toUpperCase(), speed: 1, unitSpeed: 1, worldType: 'siege' },
      switchWorld,
      activePlayerName,
      activePlayer,
      masterData,
      switchPlayer,
      refreshWorlds,
      refreshActivePlayer,
      loadingWorlds,
      loadingPlayer
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppContextProvider");
  }
  return context;
}
