// Enhanced client-side script for Emoji Battle Royale
const socket = io(window.location.origin);
const grid = document.getElementById('grid');
const scoresList = document.getElementById('scores');
const timerDisplay = document.getElementById('timer');
const playerNameDisplay = document.getElementById('player-name');
const onlinePlayersDisplay = document.getElementById('online-players');
const comboMultiplierDisplay = document.getElementById('combo-multiplier');
const notification = document.getElementById('notification');

// UI Element References
const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('name-input');
const changeNameBtn = document.getElementById('change-name');
const saveNameBtn = document.getElementById('save-name');
const cancelNameBtn = document.getElementById('cancel-name');
const shuffleGridBtn = document.getElementById('shuffle-grid');
const hintButton = document.getElementById('hint-button');
const waitingMessage = document.getElementById('waiting-message');
const startGameBtn = document.getElementById('start-game');
const gameOverModal = document.getElementById('game-over-modal');
const winnerAnnouncement = document.getElementById('winner-announcement');
const finalScoresDisplay = document.getElementById('final-scores');
const playAgainBtn = document.getElementById('play-again');
const helpModal = document.getElementById('help-modal');
const showHelpBtn = document.getElementById('show-help');
const closeHelpBtn = document.getElementById('close-help');
const powerupTooltip = document.getElementById('powerup-tooltip');

// Game state variables
let gameGrid = [];
let playerId = '';
let playerName = '';
let selected = null;
let lastMatchTime = 0;
let comboActive = false;
let hintTimeout = null;
let gameActive = false;
let waitingForPlayers = true;
let currentHints = [];

// Powerup information for tooltips
const powerupInfo = {
  '⚡': 'Lightning: Clears entire row',
  '💣': 'Bomb: Clears 3x3 area around this cell',
  '🔄': 'Refresh: Shuffles part of the grid',
  '⭐': 'Star: Double points for 10 seconds',
  '🕒': 'Clock: Adds 15 seconds to the timer'
};

// Initialize the game grid with emoji cells
function initGrid(gridData) {
  grid.innerHTML = ''; // Clear existing grid
  
  if (gridData) {
    gameGrid = gridData;
  }

  gameGrid.forEach((row, i) => {
    row.forEach((emoji, j) => {
      const cell = document.createElement('div');
      cell.className = 'emoji-cell flex items-center justify-center';
      cell.textContent = emoji;
      cell.dataset.row = i;
      cell.dataset.col = j;
      
      // Add special styling for powerup cells
      if (['⚡', '💣', '🔄', '⭐', '🕒'].includes(emoji)) {
        cell.classList.add('powerup');
        
        // Add tooltip functionality
        cell.addEventListener('mouseenter', () => {
          showPowerupTooltip(emoji, cell);
        });
        
        cell.addEventListener('mouseleave', () => {
          hidePowerupTooltip();
        });
      }
      
      cell.addEventListener('click', () => handleClick(i, j));
      grid.appendChild(cell);
    });
  });
}

// Handle click on a cell
function handleClick(row, col) {
  if (!gameActive) {
    showNotification('Game hasn\'t started yet!');
    return;
  }

  const clickedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  
  if (!selected) {
    // First selection
    selected = { row, col };
    clickedCell.classList.add('selected');
    return;
  }
  
  const { row: r1, col: c1 } = selected;
  
  // If clicking the same cell, deselect it
  if (row === r1 && col === c1) {
    clickedCell.classList.remove('selected');
    selected = null;
    return;
  }
  
  const prevSelected = document.querySelector(`[data-row="${r1}"][data-col="${c1}"]`);
  if (prevSelected) prevSelected.classList.remove('selected');
  
  // Check if adjacent
  const isAdjacent =
    (Math.abs(row - r1) === 1 && col === c1) ||
    (Math.abs(col - c1) === 1 && row === r1);
  
  if (isAdjacent && gameGrid[row][col] === gameGrid[r1][c1]) {
    socket.emit('move', {
      player: socket.id,
      from: { row: r1, col: c1 },
      to: { row, col }
    });
    
    // Visual feedback for match
    const now = Date.now();
    if (now - lastMatchTime < 2000) {
      createScoreFlash(clickedCell, '+5');
    }
    lastMatchTime = now;
    
    addMatchAnimation([prevSelected, clickedCell]);
  } else if (!isAdjacent) {
    shakeElement(clickedCell);
    showNotification('Cells must be adjacent!');
  } else {
    shakeElement(clickedCell);
    showNotification('Emojis must match!');
  }
  
  selected = null;
}

// Add match animation to cells
function addMatchAnimation(cells) {
  cells.forEach(cell => {
    cell.classList.add('match-animation');
    setTimeout(() => {
      cell.classList.remove('match-animation');
    }, 500);
  });
  
  // Create explosion effect at match location
  const cell = cells[0];
  const rect = cell.getBoundingClientRect();
  createExplosionEffect(rect.left + rect.width/2, rect.top + rect.height/2);
}

// Create explosion visual effect
function createExplosionEffect(x, y) {
  const explosion = document.createElement('div');
  explosion.className = 'explosion';
  explosion.style.width = '100px';
  explosion.style.height = '100px';
  explosion.style.left = `${x - 50}px`;
  explosion.style.top = `${y - 50}px`;
  document.body.appendChild(explosion);
  
  setTimeout(() => {
    document.body.removeChild(explosion);
  }, 600);
  
  // Add some confetti particles
  for (let i = 0; i < 10; i++) {
    createConfettiParticle(x, y);
  }
}

// Create confetti particle effect
function createConfettiParticle(x, y) {
  const colors = ['#FCD34D', '#F59E0B', '#60A5FA', '#34D399', '#EC4899'];
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  confetti.style.left = `${x}px`;
  confetti.style.top = `${y}px`;
  confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
  confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
  
  // Random sizes for variety
  const size = 5 + Math.random() * 10;
  confetti.style.width = `${size}px`;
  confetti.style.height = `${size}px`;
  
  // Random horizontal movement
  const horizontalDirection = Math.random() > 0.5 ? 1 : -1;
  confetti.style.setProperty('--horizontal-direction', horizontalDirection);
  
  document.body.appendChild(confetti);
  
  setTimeout(() => {
    document.body.removeChild(confetti);
  }, 4000);
}

// Create score flash animation
function createScoreFlash(element, text) {
  const rect = element.getBoundingClientRect();
  const flash = document.createElement('div');
  flash.className = 'score-flash';
  flash.textContent = text;
  flash.style.left = `${rect.left + rect.width/2 - 20}px`;
  flash.style.top = `${rect.top}px`;
  
  document.body.appendChild(flash);
  
  setTimeout(() => {
    document.body.removeChild(flash);
  }, 800);
}

// Show notification message
function showNotification(message) {
  notification.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Update scores and leaderboard
function updateScores(data) {
  const { scores, playerNames } = data;
  scoresList.innerHTML = '';
  
  // Convert to array for sorting
  const players = Object.entries(scores)
    .map(([id, score]) => ({ id, score, name: playerNames[id] || id.slice(0, 4) }))
    .sort((a, b) => b.score - a.score); // Sort by score (descending)
  
  players.forEach(player => {
    const scoreItem = document.createElement('div');
    scoreItem.className = 'score-item';
    if (player.id === socket.id) {
      scoreItem.classList.add('self');
    }
    
    scoreItem.innerHTML = `
      <span>${player.name}</span>
      <span>${player.score}</span>
    `;
    
    scoresList.appendChild(scoreItem);
  });
}

// Update final scores for game over modal
function updateFinalScores(data) {
  const { scores, playerNames } = data;
  finalScoresDisplay.innerHTML = '';
  
  // Convert to array for sorting
  const players = Object.entries(scores)
    .map(([id, score]) => ({ id, score, name: playerNames[id] || id.slice(0, 4) }))
    .sort((a, b) => b.score - a.score); // Sort by score (descending)
  
  players.forEach((player, index) => {
    const scoreItem = document.createElement('div');
    scoreItem.className = 'score-item';
    if (player.id === socket.id) {
      scoreItem.classList.add('self');
    }
    
    // Add rank badges for top 3
    let rankBadge = '';
    if (index === 0) rankBadge = '<span class="badge badge-green">1st</span>';
    else if (index === 1) rankBadge = '<span class="badge badge-blue">2nd</span>';
    else if (index === 2) rankBadge = '<span class="badge badge-blue">3rd</span>';
    
    scoreItem.innerHTML = `
      <span>${player.name} ${rankBadge}</span>
      <span>${player.score}</span>
    `;
    
    finalScoresDisplay.appendChild(scoreItem);
  });
}

// Update timer display with visual cues
function updateTimer(time) {
  timerDisplay.textContent = time;
  
  // Visual cues for time running out
  if (time <= 10) {
    timerDisplay.classList.add('urgent');
  } else {
    timerDisplay.classList.remove('urgent');
  }
}

// Show powerup tooltip
function showPowerupTooltip(emoji, element) {
  if (powerupInfo[emoji]) {
    const rect = element.getBoundingClientRect();
    powerupTooltip.textContent = powerupInfo[emoji];
    powerupTooltip.style.left = `${rect.left}px`;
    powerupTooltip.style.top = `${rect.bottom + 5}px`;
    powerupTooltip.style.opacity = '1';
  }
}

// Hide powerup tooltip
function hidePowerupTooltip() {
  powerupTooltip.style.opacity = '0';
}

// Shake element for invalid moves
function shakeElement(element) {
  element.classList.add('shake-animation');
  setTimeout(() => {
    element.classList.remove('shake-animation');
  }, 500);
}

// Show combo multiplier UI
function showComboMultiplier(active) {
  if (active) {
    comboMultiplierDisplay.classList.add('active');
  } else {
    comboMultiplierDisplay.classList.remove('active');
  }
}

// Provide hint by highlighting possible matches
function showHint() {
  // Clear any existing hints
  clearHints();
  
  // Search for possible matches
  let foundMatch = false;
  
  // Check horizontal matches
  for (let r = 0; r < gameGrid.length; r++) {
    for (let c = 0; c < gameGrid[r].length - 1; c++) {
      if (gameGrid[r][c] === gameGrid[r][c + 1]) {
        highlightHint(r, c, r, c + 1);
        foundMatch = true;
        break;
      }
    }
    if (foundMatch) break;
  }
  
  // If no horizontal match found, check vertical
  if (!foundMatch) {
    for (let c = 0; c < gameGrid[0].length; c++) {
      for (let r = 0; r < gameGrid.length - 1; r++) {
        if (gameGrid[r][c] === gameGrid[r + 1][c]) {
          highlightHint(r, c, r + 1, c);
          foundMatch = true;
          break;
        }
      }
      if (foundMatch) break;
    }
  }
  
  // If still no match, look for powerups
  if (!foundMatch) {
    for (let r = 0; r < gameGrid.length; r++) {
      for (let c = 0; c < gameGrid[r].length; c++) {
        if (['⚡', '💣', '🔄', '⭐', '🕒'].includes(gameGrid[r][c])) {
          highlightHint(r, c);
          foundMatch = true;
          break;
        }
      }
      if (foundMatch) break;
    }
  }
  
  if (!foundMatch) {
    showNotification('No matches found! Try shuffling the grid.');
  }
  
  // Clear hints after 3 seconds
  hintTimeout = setTimeout(() => {
    clearHints();
  }, 3000);
}

// Highlight cells for hint
function highlightHint(r1, c1, r2, c2) {
  const cell1 = document.querySelector(`[data-row="${r1}"][data-col="${c1}"]`);
  cell1.classList.add('hint');
  currentHints.push(cell1);
  
  if (r2 !== undefined && c2 !== undefined) {
    const cell2 = document.querySelector(`[data-row="${r2}"][data-col="${c2}"]`);
    cell2.classList.add('hint');
    currentHints.push(cell2);
  }
}

// Clear hint highlights
function clearHints() {
  if (hintTimeout) {
    clearTimeout(hintTimeout);
    hintTimeout = null;
  }
  
  currentHints.forEach(cell => {
    cell.classList.remove('hint');
  });
  currentHints = [];
}

// Socket event handlers
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  playerId = socket.id;
  
  // Check for saved name in localStorage
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    socket.emit('setName', savedName);
    playerName = savedName;
    playerNameDisplay.textContent = savedName;
  }
});

socket.on('welcome', (data) => {
  console.log('Welcome data received:', data);
  gameGrid = data.grid;
  initGrid(data.grid);
  gameActive = data.gameActive;
  waitingForPlayers = data.waitingForPlayers;
  
  // Update UI based on game state
  if (waitingForPlayers) {
    waitingMessage.classList.remove('hidden');
  } else {
    waitingMessage.classList.add('hidden');
  }
  
  updateTimer(data.timeLeft);
});

socket.on('nameSet', (name) => {
  playerName = name;
  playerNameDisplay.textContent = name;
  localStorage.setItem('playerName', name);
});

socket.on('updateGrid', (newGrid) => {
  gameGrid = newGrid;
  initGrid(newGrid);
  clearHints(); // Clear any active hints when grid updates
});

socket.on('updateScores', (data) => {
  updateScores(data);
});

socket.on('updateTimer', (time) => {
  updateTimer(time);
});

socket.on('notification', (message) => {
  showNotification(message);
});

socket.on('playerCount', (count) => {
  onlinePlayersDisplay.textContent = count;
});

socket.on('playerJoined', (data) => {
  showNotification(`${data.name} joined the game!`);
});

socket.on('playerLeft', (data) => {
  showNotification(`${data.name} left the game!`);
});

socket.on('matchMade', (data) => {
  // Visual feedback handled by addMatchAnimation in handleClick function
});

socket.on('gridShuffled', (newGrid) => {
  gameGrid = newGrid;
  initGrid(newGrid);
  
  const gridElement = document.getElementById('grid');
  gridElement.classList.add('shake-animation');
  setTimeout(() => {
    gridElement.classList.remove('shake-animation');
  }, 500);
});

socket.on('gameStarted', (data) => {
  gameGrid = data.grid;
  initGrid(data.grid);
  gameActive = true;
  waitingForPlayers = false;
  waitingMessage.classList.add('hidden');
  updateTimer(data.timeLeft);
  showNotification('Game has started! Match identical adjacent emojis.');
});

socket.on('gameOver', (data) => {
  gameActive = false;
  waitingForPlayers = true;
  gameOverModal.classList.add('active');
  
  const { winners, winnerNames, scores, playerNames } = data;
  
  // Check if current player is a winner
  const isWinner = winners.includes(socket.id);
  
  if (winners.length === 1) {
    winnerAnnouncement.textContent = `${winnerNames} wins!`;
  } else {
    winnerAnnouncement.textContent = `${winnerNames} tie for the win!`;
  }
  
  updateFinalScores({scores, playerNames});
  
  // Celebration effects if player won
  if (isWinner) {
    createWinnerCelebration();
  }
});

socket.on('resetGame', () => {
  gameActive = false;
  waitingForPlayers = true;
  waitingMessage.classList.remove('hidden');
  selected = null;
  clearHints();
});

// Create winner celebration effects
function createWinnerCelebration() {
  // Create multiple confetti particles
  for (let i = 0; i < 100; i++) {
    setTimeout(() => {
      const x = Math.random() * window.innerWidth;
      const y = 0;
      createConfettiParticle(x, y);
    }, i * 50);
  }
}

// Event listeners for UI elements
changeNameBtn.addEventListener('click', () => {
  nameInput.value = playerName;
  nameModal.classList.add('active');
});

saveNameBtn.addEventListener('click', () => {
  const newName = nameInput.value.trim();
  if (newName.length > 0 && newName.length <= 20) {
    socket.emit('setName', newName);
    nameModal.classList.remove('active');
  } else {
    nameInput.classList.add('border-red-500');
    setTimeout(() => {
      nameInput.classList.remove('border-red-500');
    }, 500);
  }
});

cancelNameBtn.addEventListener('click', () => {
  nameModal.classList.remove('active');
});

shuffleGridBtn.addEventListener('click', () => {
  if (gameActive) {
    socket.emit('requestShuffle');
    showNotification('Shuffling grid...');
  } else {
    showNotification('Game hasn\'t started yet!');
  }
});

hintButton.addEventListener('click', () => {
  if (gameActive) {
    showHint();
  } else {
    showNotification('Game hasn\'t started yet!');
  }
});

startGameBtn.addEventListener('click', () => {
  socket.emit('requestStart');
});

playAgainBtn.addEventListener('click', () => {
  gameOverModal.classList.remove('active');
  socket.emit('requestStart');
});

showHelpBtn.addEventListener('click', () => {
  helpModal.classList.add('active');
});

closeHelpBtn.addEventListener('click', () => {
  helpModal.classList.remove('active');
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    // 'H' key for hint
    if (gameActive) {
      showHint();
    }
  } else if (e.key === 's' || e.key === 'S') {
    // 'S' key for shuffle
    if (gameActive) {
      socket.emit('requestShuffle');
    }
  } else if (e.key === 'Escape') {
    // Escape to close modals
    nameModal.classList.remove('active');
    helpModal.classList.remove('active');
    // Don't close game over modal with escape
  }
});

// Handle socket reconnection
socket.on('disconnect', () => {
  showNotification('Disconnected from server. Trying to reconnect...');
});

socket.on('reconnect', () => {
  showNotification('Reconnected to server!');
  // Re-request game state
  socket.emit('requestGameState');
});

// Responsive adjustments
function handleResponsiveLayout() {
  if (window.innerWidth < 640) {
    // Mobile adjustments
  } else if (window.innerWidth < 1024) {
    // Tablet adjustments
  } else {
    // Desktop layout
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  handleResponsiveLayout();
  helpModal.classList.add('active'); // Show help on first load
});

window.addEventListener('resize', handleResponsiveLayout);

// Additional socket listeners for enhanced features

socket.on('finalCountdown', (time) => {
  // Flash timer for final countdown
  timerDisplay.classList.add('pulse-animation');
  showNotification(`${time} seconds remaining!`);
});

socket.on('comboActivated', () => {
  comboActive = true;
  showComboMultiplier(true);
  setTimeout(() => {
    comboActive = false;
    showComboMultiplier(false);
  }, 10000); // 10 seconds combo time
});

// Add touchstart support for mobile devices
if ('ontouchstart' in window) {
  document.querySelectorAll('.emoji-cell').forEach(cell => {
    cell.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      handleClick(row, col);
    });
  });
}