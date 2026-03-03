// server.js (БЕКЕНД)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const rooms = {};

const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create_room', (user, callback) => {
    let roomCode = generateRoomCode();
    while (rooms[roomCode]) roomCode = generateRoomCode();

    rooms[roomCode] = {
      hostId: user.id,
      players: [user],
      gameState: null 
    };

    socket.join(roomCode);
    callback({ success: true, roomCode });
  });

  socket.on('join_room', ({ roomCode, user }, callback) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) return callback({ success: false, error: 'Кімнату не знайдено' });

    // ЛОГІКА ПЕРЕПІДКЛЮЧЕННЯ (Якщо гра вже йде, пускаємо тільки своїх)
    if (room.gameState) {
      const isExistingPlayer = room.gameState.players.some(p => p.id === user.id);
      const isHost = room.hostId === user.id;

      if (isExistingPlayer || isHost) {
        socket.join(code);
        // Одразу відправляємо людині поточний стан гри, щоб вона відновила екран
        socket.emit('game_started', room.gameState); 
        return callback({ success: true, roomCode: code });
      } else {
        return callback({ success: false, error: 'Гра вже почалася, вхід закрито' });
      }
    }

    // Звичайний вхід (якщо гра ще не почалась)
    const existingPlayerIndex = room.players.findIndex(p => p.id === user.id);
    if (existingPlayerIndex === -1) {
        room.players.push(user);
    } else {
        room.players[existingPlayerIndex] = user; 
    }

    socket.join(code);
    io.to(code).emit('room_updated', room.players);
    callback({ success: true, roomCode: code });
  });

  socket.on('start_game', ({ roomCode, gameData }) => {
    const room = rooms[code = roomCode];
    if (room) {
      room.gameState = gameData;
      io.to(roomCode).emit('game_started', room.gameState);
    }
  });

  socket.on('reveal_trait', ({ roomCode, targetPlayerId, traitIndex }) => {
    const room = rooms[roomCode];
    if (room && room.gameState) {
      const playerIndex = room.gameState.players.findIndex(p => p.id === targetPlayerId);
      if (playerIndex !== -1) {
        room.gameState.players[playerIndex].traits[traitIndex].visible = true;
        io.to(roomCode).emit('game_updated', room.gameState);
      }
    }
  });

  socket.on('update_game_state', ({ roomCode, newState }) => {
    const room = rooms[roomCode];
    if (room) {
      room.gameState = newState;
      io.to(roomCode).emit('game_updated', room.gameState);
    }
  });

  // НОВА КОМАНДА ДЛЯ КІКУ
  socket.on('kick_player', ({ roomCode, targetPlayerId }) => {
    const room = rooms[roomCode];
    if (room && room.gameState) {
      room.gameState.players = room.gameState.players.filter(p => p.id !== targetPlayerId);
      room.players = room.players.filter(p => p.id !== targetPlayerId);
      
      io.to(roomCode).emit('game_updated', room.gameState);
      io.to(roomCode).emit('room_updated', room.players);
      // Кажемо конкретному гравцю, що його вигнали
      io.to(roomCode).emit('player_kicked', targetPlayerId); 
    }
  });

  socket.on('reset_room', (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
      room.gameState = null;
      io.to(roomCode).emit('room_reset');
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bunker server running on port ${PORT}`);
});