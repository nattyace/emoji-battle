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

// Expanded emoji collection for more variety
const emojis = ['😄', '😂', '🚀', '🌟', '🍎', '🐶', '🦄', '🌈', '🍕', '🎮', '🎸', '🏆'];
let gameGrid = [];
let scores = {};
let playerNames = {};
let timeLeft = 120; // Extended game time
let gameActive = false;
let waitingForPlayers = true;
let minPlayers = 2;
let comboMultiplier = {};
let powerups = {};

// Generate grid with guaranteed matches
function generateGrid() {
  const grid = Array(6).fill().map(() => 
    Array(6).fill().map(() => emojis[Math.floor(Math.random() * emojis.length)])
  );
  
  // Ensure the grid has at least 3 possible matches
  let matchCount = countPossibleMatches(grid);
  while (matchCount < 3) {
    // Create some matches by inserting identical adjacent emojis
    const r = Math.floor(Math.random() * 5);
    const c = Math.floor(Math.random() * 5);
    grid[r][c] = grid[r+1][c]; // Create a vertical match
    
    const r2 = Math.floor(Math.random() * 5);
    const c2 = Math.floor(Math.random() * 5);
    grid[r2][c2] = grid[r2][c2+1]; // Create a horizontal match
    
    matchCount = countPossibleMatches(grid);
  }
  
  return grid;
}

// Count possible matches in the grid
function countPossibleMatches(grid) {
  let count = 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      // Check right
      if (c < 5 && grid[r][c] === grid[r][c+1]) count++;
      // Check down
      if (r < 5 && grid[r][c] === grid[r+1][c]) count++;
    }
  }
  return count;
}

// Generate special powerup emojis occasionally
function maybeGeneratePowerup() {
  const powerupChance = 0.15; // 15% chance to generate a powerup
  if (Math.random() < powerupChance) {
    const powerups = ['⚡', '💣', '🔄', '⭐', '🕒'];
    return powerups[Math.floor(Math.random() * powerups.length)];
  }
  return null;
}

// Check if the grid still has possible moves
function gridHasMoves(grid) {
  return countPossibleMatches(grid) > 0;
}

// Shuffle the grid if no moves are possible
function shuffleGridIfNeeded() {
  if (!gridHasMoves(gameGrid)) {
    const flatGrid = gameGrid.flat();
    for (let i = flatGrid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flatGrid[i], flatGrid[j]] = [flatGrid[j], flatGrid[i]];
    }
    
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        gameGrid[r][c] = flatGrid[r * 6 + c];
      }
    }
    
    // If still no moves after shuffle, ensure at least one match
    if (!gridHasMoves(gameGrid)) {
      const r = Math.floor(Math.random() * 5);
      const c = Math.floor(Math.random() * 6);
      gameGrid[r+1][c] = gameGrid[r][c];
    }
    
    io.emit('gridShuffled', gameGrid);
    io.emit('notification', 'Grid has been shuffled - no moves were available!');
  }
}

// Reset game state
function resetGame() {
  gameGrid = generateGrid();
  timeLeft = 120;
  gameActive = false;
  waitingForPlayers = true;
  
  // Reset scores but keep player names
  Object.keys(scores).forEach(id => {
    scores[id] = 0;
    comboMultiplier[id] = 1;
  });
  
  io.emit('updateGrid', gameGrid);
  io.emit('updateScores', { scores, playerNames });
  io.emit('resetGame');
  io.emit('notification', 'Game has been reset. Waiting for players...');
}

// Apply powerup effects
function applyPowerup(player, type, row, col) {
  switch(type) {
    case '⚡': // Lightning: Clear row
      for (let c = 0; c < 6; c++) {
        if (c !== col) {
          scores[player] += 5;
          gameGrid[row][c] = emojis[Math.floor(Math.random() * emojis.length)];
        }
      }
      io.emit('notification', `${playerNames[player]} used Lightning Powerup!`);
      break;
      
    case '💣': // Bomb: Clear 3x3 area
      for (let r = Math.max(0, row-1); r <= Math.min(5, row+1); r++) {
        for (let c = Math.max(0, col-1); c <= Math.min(5, col+1); c++) {
          if (r !== row || c !== col) {
            scores[player] += 3;
            gameGrid[r][c] = emojis[Math.floor(Math.random() * emojis.length)];
          }
        }
      }
      io.emit('notification', `${playerNames[player]} used Bomb Powerup!`);
      break;
      
    case '🔄': // Refresh: Shuffle part of the grid
      for (let i = 0; i < 9; i++) {
        const r = Math.floor(Math.random() * 6);
        const c = Math.floor(Math.random() * 6);
        gameGrid[r][c] = emojis[Math.floor(Math.random() * emojis.length)];
      }
      io.emit('notification', `${playerNames[player]} used Refresh Powerup!`);
      break;
      
    case '⭐': // Star: Double points temporarily
      comboMultiplier[player] = 2;
      io.emit('notification', `${playerNames[player]} activated Double Points for 10 seconds!`);
      setTimeout(() => {
        comboMultiplier[player] = 1;
        io.to(player).emit('notification', 'Double Points bonus ended');
      }, 10000);
      break;
      
    case '🕒': // Clock: Add time
      timeLeft += 15;
      io.emit('updateTimer', timeLeft);
      io.emit('notification', `${playerNames[player]} added 15 seconds to the clock!`);
      break;
  }
}

// Check for chain reactions (matching emojis after a match)
function checkForChains(row, col, player) {
  // Check horizontal neighbors
  if (col > 0 && col < 5 && gameGrid[row][col-1] === gameGrid[row][col+1]) {
    scores[player] += 15 * comboMultiplier[player];
    gameGrid[row][col-1] = emojis[Math.floor(Math.random() * emojis.length)];
    gameGrid[row][col+1] = emojis[Math.floor(Math.random() * emojis.length)];
    io.emit('notification', `${playerNames[player]} made a chain reaction! +15 points`);
    return true;
  }
  
  // Check vertical neighbors
  if (row > 0 && row < 5 && gameGrid[row-1][col] === gameGrid[row+1][col]) {
    scores[player] += 15 * comboMultiplier[player];
    gameGrid[row-1][col] = emojis[Math.floor(Math.random() * emojis.length)];
    gameGrid[row+1][col] = emojis[Math.floor(Math.random() * emojis.length)];
    io.emit('notification', `${playerNames[player]} made a chain reaction! +15 points`);
    return true;
  }
  
  return false;
}

// Start a new game
function startGame() {
  if (Object.keys(playerNames).length >= minPlayers) {
    gameGrid = generateGrid();
    gameActive = true;
    waitingForPlayers = false;
    timeLeft = 120;
    
    Object.keys(scores).forEach(id => {
      scores[id] = 0;
      comboMultiplier[id] = 1;
    });
    
    io.emit('gameStarted', { grid: gameGrid, timeLeft });
    io.emit('updateScores', { scores, playerNames });
    io.emit('notification', 'Game has started! Match adjacent identical emojis.');
  } else {
    io.emit('notification', `Waiting for more players. Need at least ${minPlayers} players.`);
  }
}

// Initialize game state
gameGrid = generateGrid();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  scores[socket.id] = 0;
  comboMultiplier[socket.id] = 1;
  playerNames[socket.id] = `Player${Math.floor(1000 + Math.random() * 9000)}`;
  
  socket.emit('welcome', {
    id: socket.id,
    grid: gameGrid,
    timeLeft: timeLeft,
    gameActive: gameActive,
    waitingForPlayers: waitingForPlayers
  });
  
  io.emit('updateScores', { scores, playerNames });
  io.emit('playerJoined', { id: socket.id, name: playerNames[socket.id] });
  io.emit('playerCount', Object.keys(playerNames).length);
  
  if (waitingForPlayers && Object.keys(playerNames).length >= minPlayers) {
    setTimeout(startGame, 5000); // Start game after 5 seconds if enough players
  }

  socket.on('setName', (name) => {
    if (name && typeof name === 'string' && name.trim().length > 0 && name.length <= 20) {
      const safeName = name.trim().replace(/[^\w\s]/gi, '');
      playerNames[socket.id] = safeName;
      io.emit('updateScores', { scores, playerNames });
      socket.emit('nameSet', safeName);
    }
  });

  socket.on('move', ({ player, from, to }) => {
    if (!gameActive) return;
    
    const { row: r1, col: c1 } = from;
    const { row: r2, col: c2 } = to;
    
    // Validate move
    if (r1 < 0 || r1 > 5 || c1 < 0 || c1 > 5 || 
        r2 < 0 || r2 > 5 || c2 < 0 || c2 > 5) {
      return; // Invalid coordinates
    }
    
    // Check if emojis match
    if (gameGrid[r1][c1] === gameGrid[r2][c2]) {
      // Check for powerups first
      const isPowerup = ['⚡', '💣', '🔄', '⭐', '🕒'].includes(gameGrid[r1][c1]);
      
      if (isPowerup) {
        applyPowerup(player, gameGrid[r1][c1], r1, c1);
      } else {
        // Regular match
        scores[player] += 10 * comboMultiplier[player];
      }
      
      // Replace matched emojis
      const powerup1 = maybeGeneratePowerup();
      const powerup2 = maybeGeneratePowerup();
      
      gameGrid[r1][c1] = powerup1 || emojis[Math.floor(Math.random() * emojis.length)];
      gameGrid[r2][c2] = powerup2 || emojis[Math.floor(Math.random() * emojis.length)];
      
      // Check for chain reactions after replacing emojis
      const chainReaction1 = checkForChains(r1, c1, player);
      const chainReaction2 = checkForChains(r2, c2, player);
      
      // Award bonus for rapid consecutive matches
      const now = Date.now();
      if (!powerups[player]) powerups[player] = { lastMatchTime: 0 };
      
      if (now - powerups[player].lastMatchTime < 2000) { // Within 2 seconds
        scores[player] += 5 * comboMultiplier[player];
        socket.emit('notification', 'Quick Match Bonus! +5 points');
      }
      powerups[player].lastMatchTime = now;
      
      io.emit('updateGrid', gameGrid);
      io.emit('updateScores', { scores, playerNames });
      
      // Special effects for the UI
      io.emit('matchMade', { positions: [from, to], player });
      
      // Check if grid needs shuffling
      setTimeout(() => shuffleGridIfNeeded(), 500);
    }
  });

  socket.on('requestStart', () => {
    if (waitingForPlayers && Object.keys(playerNames).length >= minPlayers) {
      startGame();
    } else if (Object.keys(playerNames).length < minPlayers) {
      socket.emit('notification', `Need at least ${minPlayers} players to start.`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    io.emit('playerLeft', { id: socket.id, name: playerNames[socket.id] });
    
    delete scores[socket.id];
    delete playerNames[socket.id];
    delete comboMultiplier[socket.id];
    if (powerups[socket.id]) delete powerups[socket.id];
    
    io.emit('updateScores', { scores, playerNames });
    io.emit('playerCount', Object.keys(playerNames).length);
    
    // Reset game if not enough players
    if (gameActive && Object.keys(playerNames).length < minPlayers) {
      gameActive = false;
      waitingForPlayers = true;
      io.emit('notification', 'Not enough players. Waiting for more players to join...');
    }
  });
});

// Game timer
setInterval(() => {
  if (gameActive && timeLeft > 0) {
    timeLeft--;
    io.emit('updateTimer', timeLeft);
    
    // Occasionally spawn a powerup
    if (timeLeft % 15 === 0) {
      const r = Math.floor(Math.random() * 6);
      const c = Math.floor(Math.random() * 6);
      const powerups = ['⚡', '💣', '🔄', '⭐', '🕒'];
      gameGrid[r][c] = powerups[Math.floor(Math.random() * powerups.length)];
      io.emit('updateGrid', gameGrid);
      io.emit('notification', 'A new powerup has appeared!');
    }
    
    // Final countdown
    if (timeLeft <= 10) {
      io.emit('finalCountdown', timeLeft);
    }
  } else if (gameActive && timeLeft <= 0) {
    // Game over
    gameActive = false;
    waitingForPlayers = true;
    
    // Find the winner
    let highestScore = -1;
    let winners = [];
    
    Object.entries(scores).forEach(([id, score]) => {
      if (score > highestScore) {
        highestScore = score;
        winners = [id];
      } else if (score === highestScore) {
        winners.push(id);
      }
    });
    
    const winnerNames = winners.map(id => playerNames[id]).join(' and ');
    io.emit('gameOver', { winners, winnerNames, scores, playerNames });
    
    // Auto restart game after 10 seconds
    setTimeout(() => {
      if (Object.keys(playerNames).length >= minPlayers) {
        startGame();
      } else {
        resetGame();
      }
    }, 10000);
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});