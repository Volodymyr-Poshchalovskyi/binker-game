import React, { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SOCKET_SERVER_URL = 'https://binker-game.onrender.com';

export const socket = io(SOCKET_SERVER_URL);
export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  // 1. Профіль гравця
  const [me, setMe] = useState(() => {
    const saved = localStorage.getItem('bunker_me');
    return saved ? JSON.parse(saved) : { id: uuidv4(), name: '' };
  });

  // 2. Зберігаємо статус кімнати та хоста в LocalStorage для відновлення
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('bunker_roomCode') || '');
  const [isHost, setIsHost] = useState(() => localStorage.getItem('bunker_isHost') === 'true');
  
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);

  // Зберігаємо зміни в localStorage
  useEffect(() => {
    if (me.name) localStorage.setItem('bunker_me', JSON.stringify(me));
    localStorage.setItem('bunker_roomCode', roomCode);
    localStorage.setItem('bunker_isHost', isHost);
  }, [me, roomCode, isHost]);

  // АВТОРЕКОННЕКТ: Якщо ми перезавантажили сторінку, і в нас є код кімнати
  useEffect(() => {
    const tryReconnect = () => {
      if (roomCode && me.name) {
        socket.emit('join_room', { roomCode, user: me }, (res) => {
          if (!res.success) {
            // Якщо сервер відхилив (наприклад сервер перезапускався), очищаємо дані
            leaveRoom();
          }
        });
      }
    };

    socket.on('connect', tryReconnect);
    if (socket.connected) tryReconnect();

    return () => socket.off('connect', tryReconnect);
  }, [roomCode, me]);

  // Слухаємо оновлення гри від сервера
  useEffect(() => {
    socket.on('room_updated', (players) => setRoomPlayers(players));
    socket.on('game_started', (state) => setGameState(state));
    socket.on('game_updated', (state) => setGameState(state));
    socket.on('room_reset', () => setGameState(null));
    
    // Якщо прийшла команда, що нас кікнули
    socket.on('player_kicked', (kickedId) => {
      if (me.id === kickedId) {
        alert("ВАС БУЛО ВИЛУЧЕНО З БУНКЕРА!");
        leaveRoom();
      }
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_started');
      socket.off('game_updated');
      socket.off('room_reset');
      socket.off('player_kicked');
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
        alert(res.error);
      }
    });
  };

  const updateGameState = (newState) => {
    setGameState(newState);
    socket.emit('update_game_state', { roomCode, newState });
  };

  const leaveRoom = () => {
    setRoomCode('');
    setIsHost(false);
    setGameState(null);
    setRoomPlayers([]);
  };

  return (
    <SocketContext.Provider value={{
      socket, me, setMe, roomCode, isHost, roomPlayers, 
      gameState, createRoom, joinRoom, updateGameState, leaveRoom
    }}>
      {children}
    </SocketContext.Provider>
  );
};