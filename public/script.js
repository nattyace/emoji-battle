const socket = io('https://emoji-battle.vercel.app');
const grid = document.getElementById('grid');
const scoresList = document.getElementById('scores');
const timerDisplay = document.getElementById('timer');

const emojis = ['😄', '😂', '🚀', '🌟', '🍎', '🐶'];
let gameGrid = Array(6).fill().map(() =>
  Array(6).fill().map(() => emojis[Math.floor(Math.random() * emojis.length)])
);
let selected = null;

function initGrid() {
  grid.innerHTML = ''; // Clear existing grid

  gameGrid.forEach((row, i) => {
    row.forEach((emoji, j) => {
      const cell = document.createElement('div');
      cell.className = 'emoji-cell flex items-center justify-center border';
      cell.textContent = emoji;
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.addEventListener('click', () => handleClick(i, j));
      grid.appendChild(cell);
    });
  });
}

function handleClick(row, col) {
  const clickedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);

  if (!selected) {
    selected = { row, col };
    clickedCell.classList.add('selected'); // Highlight selected
    return;
  }

  const { row: r1, col: c1 } = selected;
  const prevSelected = document.querySelector(`[data-row="${r1}"][data-col="${c1}"]`);
  if (prevSelected) prevSelected.classList.remove('selected'); // Remove old selection

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
  }

  selected = null;
}

socket.on('connect', () => {
  console.log('Connected to server');
  initGrid();
});

socket.on('updateGrid', (newGrid) => {
  gameGrid = newGrid;
  initGrid();
});

socket.on('updateScores', (scores) => {
  scoresList.innerHTML = Object.entries(scores)
    .map(([id, score]) => `<li>Player ${id.slice(0, 4)}: ${score}</li>`)
    .join('');
});

socket.on('updateTimer', (time) => {
  timerDisplay.textContent = time;
  if (time === 0) alert('Game Over!');
});
