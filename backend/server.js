// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Дозволяємо підключення з будь-якого домену (твого localhost та Vercel)
    methods: ["GET", "POST"]
  }
});

// Зберігаємо стан кімнат у пам'яті
const rooms = {};

// Генерація 5-значного коду (цифри + літери)
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

  // Створення кімнати (Ведучий)
  socket.on('create_room', (user, callback) => {
    let roomCode = generateRoomCode();
    // Гарантуємо унікальність коду
    while (rooms[roomCode]) {
      roomCode = generateRoomCode();
    }

    rooms[roomCode] = {
      hostId: user.id,
      players: [user],
      gameState: null // Тут буде макро, мікро і згенеровані гравці
    };

    socket.join(roomCode);
    callback({ success: true, roomCode });
  });

  // Приєднання до кімнати (Гравці)
  socket.on('join_room', ({ roomCode, user }, callback) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) {
      return callback({ success: false, error: 'Кімнату не знайдено' });
    }
    if (room.gameState) {
      return callback({ success: false, error: 'Гра вже почалася' });
    }

    // Додаємо гравця, якщо його ще там немає
    const existingPlayerIndex = room.players.findIndex(p => p.id === user.id);
    if (existingPlayerIndex === -1) {
        room.players.push(user);
    } else {
        room.players[existingPlayerIndex] = user; // Оновлюємо ім'я, якщо змінилося
    }

    socket.join(code);
    io.to(code).emit('room_updated', room.players);
    callback({ success: true, roomCode: code });
  });

  // Запуск гри ведучим (передача згенерованих даних)
  socket.on('start_game', ({ roomCode, gameData }) => {
    const room = rooms[roomCode];
    if (room) {
      room.gameState = gameData;
      io.to(roomCode).emit('game_started', room.gameState);
    }
  });

  // Відкриття характеристики ведучим
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

  // Інші дії (номінація, голосування, кік)
  socket.on('update_game_state', ({ roomCode, newState }) => {
    const room = rooms[roomCode];
    if (room) {
      room.gameState = newState;
      io.to(roomCode).emit('game_updated', room.gameState);
    }
  });

  // Скидання кімнати
  socket.on('reset_room', (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
      room.gameState = null;
      io.to(roomCode).emit('room_reset');
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Можна додати логіку відключення, але для простоти поки залишаємо гравців у списку
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bunker server running on port ${PORT}`);
});