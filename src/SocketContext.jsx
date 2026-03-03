import React, { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SOCKET_SERVER_URL = 'https://binker-game.onrender.com';

export const socket = io(SOCKET_SERVER_URL);
export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [me, setMe] = useState(() => {
    const saved = localStorage.getItem('bunker_me');
    return saved ? JSON.parse(saved) : { id: uuidv4(), name: '' };
  });

  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('bunker_roomCode') || '');
  const [isHost, setIsHost] = useState(() => localStorage.getItem('bunker_isHost') === 'true');
  
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);

  // Кастомний Alert для всього додатку
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', onConfirm: null });

  const closeAlert = () => {
    if (alertModal.onConfirm) alertModal.onConfirm();
    setAlertModal({ isOpen: false, message: '', onConfirm: null });
  };

  useEffect(() => {
    if (me.name) localStorage.setItem('bunker_me', JSON.stringify(me));
    if (roomCode) localStorage.setItem('bunker_roomCode', roomCode);
    localStorage.setItem('bunker_isHost', isHost);
  }, [me, roomCode, isHost]);

  useEffect(() => {
    const tryReconnect = () => {
      const savedCode = localStorage.getItem('bunker_roomCode');
      if (savedCode && me.name) {
        socket.emit('join_room', { roomCode: savedCode, user: me }, (res) => {
          if (!res.success) {
            leaveRoomLocally();
          }
        });
      }
    };

    socket.on('connect', tryReconnect);
    if (socket.connected) tryReconnect();

    return () => socket.off('connect', tryReconnect);
  }, [me]);

  useEffect(() => {
    socket.on('room_updated', (players) => setRoomPlayers(players));
    socket.on('game_started', (state) => setGameState(state));
    
    socket.on('game_updated', (state) => {
      setGameState(state);
      
      const currentHostStatus = localStorage.getItem('bunker_isHost') === 'true';
      if (state && !currentHostStatus && me.id) {
        const amIStillHere = state.players.some(p => p.id === me.id);
        if (!amIStillHere) {
          setAlertModal({
            isOpen: true,
            message: "☠️ ВАС БУЛО ВИЛУЧЕНО З БУНКЕРА!",
            onConfirm: () => leaveRoomLocally()
          });
        }
      }
    });

    socket.on('room_reset', () => {
      setAlertModal({
        isOpen: true,
        message: "⚠️ Ведучий скинув систему. Гру завершено.",
        onConfirm: () => {
          leaveRoomLocally();
          window.location.href = '/'; 
        }
      });
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_started');
      socket.off('game_updated');
      socket.off('room_reset');
    };
  }, [me.id]);

  const createRoom = () => {
    socket.emit('create_room', me, (res) => {
      if (res.success) {
        setRoomCode(res.roomCode);
        setIsHost(true);
        setRoomPlayers([me]);
      }
    });
  };

  const joinRoom = (code) => {
    socket.emit('join_room', { roomCode: code, user: me }, (res) => {
      if (res.success) {
        setRoomCode(res.roomCode);
        setIsHost(false);
      } else {
        // Кастомна модалка замість alert()
        setAlertModal({ isOpen: true, message: res.error, onConfirm: null });
      }
    });
  };

  const updateGameState = (newState) => {
    setGameState(newState);
    socket.emit('update_game_state', { roomCode, newState });
  };

  const leaveRoomLocally = () => {
    setRoomCode('');
    setIsHost(false);
    setGameState(null);
    setRoomPlayers([]);
    localStorage.removeItem('bunker_roomCode');
    localStorage.removeItem('bunker_isHost');
  };

  const leaveRoom = () => {
    if (isHost && roomCode) {
      socket.emit('reset_room', roomCode);
    }
    leaveRoomLocally();
  };

  return (
    <SocketContext.Provider value={{
      socket, me, setMe, roomCode, isHost, roomPlayers, 
      gameState, createRoom, joinRoom, updateGameState, leaveRoom
    }}>
      {children}

      {/* ГЛОБАЛЬНА КАСТОМНА МОДАЛКА */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-zinc-950 border border-red-900/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(153,27,27,0.2)] max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-zinc-100 mb-6 leading-relaxed">{alertModal.message}</h3>
            <button onClick={closeAlert} className="w-full py-3 bg-red-900 hover:bg-red-800 text-white font-bold rounded-lg uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(153,27,27,0.3)]">
              Зрозуміло
            </button>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
};