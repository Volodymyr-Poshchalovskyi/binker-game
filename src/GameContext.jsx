import React, { createContext, useState, useEffect } from 'react';

export const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [gameData, setGameData] = useState(() => {
    const saved = localStorage.getItem('bunker_game');
    return saved ? JSON.parse(saved) : { players: [], synopsis: '', isStarted: false };
  });

  useEffect(() => {
    localStorage.setItem('bunker_game', JSON.stringify(gameData));
  }, [gameData]);

  const clearGame = () => {
    setGameData({ players: [], synopsis: '', isStarted: false });
    localStorage.removeItem('bunker_game');
  };

  return (
    <GameContext.Provider value={{ gameData, setGameData, clearGame }}>
      {children}
    </GameContext.Provider>
  );
};