const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Improved CORS configuration
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://emoji-battle.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Add Express CORS middleware for REST endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000, https://emoji-battle.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static('public'));

const emojis = ['😄', '😂', '🚀', '🌟', '🍎', '🐶'];
let gameGrid = Array(6).fill().map(() => Array(6).fill().map(() => emojis[Math.floor(Math.random() * emojis.length)]));
let scores = {};
let timeLeft = 60;

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  scores[socket.id] = 0;
  io.emit('updateScores', scores);
  io.emit('updateGrid', gameGrid);

  socket.on('move', ({ player, from, to }) => {
    const { row: r1, col: c1 } = from;
    const { row: r2, col: c2 } = to;
    if (gameGrid[r1][c1] === gameGrid[r2][c2]) {
      scores[player] += 10;
      gameGrid[r1][c1] = emojis[Math.floor(Math.random() * emojis.length)];
      gameGrid[r2][c2] = emojis[Math.floor(Math.random() * emojis.length)];
      io.emit('updateGrid', gameGrid);
      io.emit('updateScores', scores);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete scores[socket.id];
    io.emit('updateScores', scores);
  });
});

setInterval(() => {
  if (timeLeft > 0) {
    timeLeft--;
    io.emit('updateTimer', timeLeft);
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});