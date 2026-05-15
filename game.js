// ── Constants ──────────────────────────────────────────
const BOARD_SIZE = 10;
const SHIPS = [
  { name: 'Carrier',    size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Submarine',  size: 3 },
  { name: 'Destroyer',  size: 2 },
];
const COLS = 'ABCDEFGHIJ';

// ── State ──────────────────────────────────────────────
let playerBoard, enemyBoard;
let playerShips, enemyShips;
let placementOrientation = 'horizontal';
let selectedShipIndex = null;
let placedShips = new Set();
let isPlayerTurn = true;
let gameActive = false;
let playerShots = 0;
let enemyShots = 0;
let bugsFound = [];

// AI hunt/target state
let aiMode = 'hunt';
let aiTargetQueue = [];
let aiHitStack = [];
let aiTriedDirections = {};
let aiFirstHit = null;
let aiLastHit = null;
let aiDirection = null;

// ── Board Creation ─────────────────────────────────────
function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      hasShip: false,
      shipId: null,
      shot: false,
      hit: false,
    }))
  );
}

function createShipTracker() {
  return SHIPS.map(s => ({
    ...s,
    cells: [],
    hits: 0,
    sunk: false,
  }));
}

// ── DOM Rendering ──────────────────────────────────────
function renderBoard(container, board, opts = {}) {
  container.innerHTML = '';
  // Corner
  const corner = document.createElement('div');
  corner.className = 'board-label';
  container.appendChild(corner);

  // Column headers
  for (let c = 0; c < BOARD_SIZE; c++) {
    const lbl = document.createElement('div');
    lbl.className = 'board-label';
    lbl.textContent = COLS[c];
    container.appendChild(lbl);
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    // Row header
    const rowLbl = document.createElement('div');
    rowLbl.className = 'board-label';
    rowLbl.textContent = r + 1;
    container.appendChild(rowLbl);

    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      const tile = board[r][c];
      if (opts.showShips && tile.hasShip) cell.classList.add('ship');
      if (tile.shot && tile.hit) {
        const ship = opts.ships && opts.ships[tile.shipId];
        if (ship && ship.sunk) {
          cell.classList.add('sunk');
        } else {
          cell.classList.add('hit');
        }
      } else if (tile.shot) {
        cell.classList.add('miss');
      }

      if (opts.onClick) {
        cell.addEventListener('click', () => opts.onClick(r, c));
      }
      if (opts.onHover) {
        cell.addEventListener('mouseenter', () => opts.onHover(r, c, true));
        cell.addEventListener('mouseleave', () => opts.onHover(r, c, false));
      }

      container.appendChild(cell);
    }
  }
}

// ── Ship Placement ─────────────────────────────────────
function getShipCells(row, col, size, orientation) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'horizontal' ? row : row + i;
    const c = orientation === 'horizontal' ? col + i : col;
    cells.push([r, c]);
  }
  return cells;
}

function canPlace(board, cells) {
  for (const [r, c] of cells) {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c].hasShip) return false;
  }
  return true;
}

function placeShip(board, ships, shipIndex, row, col, orientation) {
  const ship = ships[shipIndex];
  const cells = getShipCells(row, col, ship.size, orientation);
  if (!canPlace(board, cells)) return false;
  for (const [r, c] of cells) {
    board[r][c].hasShip = true;
    board[r][c].shipId = shipIndex;
  }
  ship.cells = cells;
  return true;
}

function randomPlacement(board, ships) {
  // Clear board
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c].hasShip = false;
      board[r][c].shipId = null;
    }
  ships.forEach(s => { s.cells = []; s.hits = 0; s.sunk = false; });

  for (let i = 0; i < ships.length; i++) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      const orient = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const r = Math.floor(Math.random() * BOARD_SIZE);
      const c = Math.floor(Math.random() * BOARD_SIZE);
      placed = placeShip(board, ships, i, r, c, orient);
      attempts++;
    }
  }
}

// ── Setup Phase UI ─────────────────────────────────────
function initSetupPhase() {
  playerBoard = createEmptyBoard();
  playerShips = createShipTracker();
  placedShips = new Set();
  selectedShipIndex = null;
  placementOrientation = 'horizontal';

  renderShipList();
  renderSetupBoard();
  updateStartButton();
  setStatus('Place your ships to begin');
}

function renderShipList() {
  const list = document.getElementById('ship-list');
  list.innerHTML = '';
  SHIPS.forEach((ship, i) => {
    const opt = document.createElement('div');
    opt.className = 'ship-option';
    if (i === selectedShipIndex) opt.classList.add('selected');
    if (placedShips.has(i)) opt.classList.add('placed');

    const preview = document.createElement('div');
    preview.className = 'ship-preview';
    for (let j = 0; j < ship.size; j++) {
      const sc = document.createElement('div');
      sc.className = 'ship-preview-cell';
      preview.appendChild(sc);
    }

    const name = document.createElement('span');
    name.className = 'ship-name';
    name.textContent = ship.name;

    opt.appendChild(preview);
    opt.appendChild(name);

    if (!placedShips.has(i)) {
      opt.addEventListener('click', () => {
        selectedShipIndex = i;
        renderShipList();
      });
    }

    list.appendChild(opt);
  });
}

function renderSetupBoard() {
  const container = document.getElementById('setup-board');
  renderBoard(container, playerBoard, {
    showShips: true,
    onClick: handleSetupClick,
    onHover: handleSetupHover,
  });
}

function handleSetupClick(row, col) {
  if (selectedShipIndex === null || placedShips.has(selectedShipIndex)) return;
  const ship = SHIPS[selectedShipIndex];
  const cells = getShipCells(row, col, ship.size, placementOrientation);
  if (!canPlace(playerBoard, cells)) return;

  placeShip(playerBoard, playerShips, selectedShipIndex, row, col, placementOrientation);
  placedShips.add(selectedShipIndex);

  // Auto-select next unplaced ship
  selectedShipIndex = null;
  for (let i = 0; i < SHIPS.length; i++) {
    if (!placedShips.has(i)) { selectedShipIndex = i; break; }
  }

  renderShipList();
  renderSetupBoard();
  updateStartButton();
}

function handleSetupHover(row, col, entering) {
  if (selectedShipIndex === null || placedShips.has(selectedShipIndex)) return;
  const container = document.getElementById('setup-board');
  // Clear previous hover
  container.querySelectorAll('.ship-hover, .ship-hover-invalid').forEach(el => {
    el.classList.remove('ship-hover', 'ship-hover-invalid');
  });

  if (!entering) return;

  const ship = SHIPS[selectedShipIndex];
  const cells = getShipCells(row, col, ship.size, placementOrientation);
  const valid = canPlace(playerBoard, cells);

  for (const [r, c] of cells) {
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cellEl = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      if (cellEl) {
        cellEl.classList.add(valid ? 'ship-hover' : 'ship-hover-invalid');
      }
    }
  }
}

function updateStartButton() {
  document.getElementById('start-btn').disabled = placedShips.size < SHIPS.length;
}

// ── Game Phase ─────────────────────────────────────────
function startGame() {
  enemyBoard = createEmptyBoard();
  enemyShips = createShipTracker();
  randomPlacement(enemyBoard, enemyShips);

  isPlayerTurn = true;
  gameActive = true;
  playerShots = 0;
  enemyShots = 0;
  resetAI();

  document.getElementById('setup-phase').classList.add('hidden');
  document.getElementById('game-phase').classList.remove('hidden');
  document.getElementById('log-entries').innerHTML = '';

  setStatus("Your turn — fire at the enemy's fleet!");
  renderGameBoards();
}

function renderGameBoards() {
  const enemyContainer = document.getElementById('enemy-board');
  const playerContainer = document.getElementById('player-board');

  renderBoard(enemyContainer, enemyBoard, {
    showShips: false,
    ships: enemyShips,
    onClick: handlePlayerShot,
  });

  renderBoard(playerContainer, playerBoard, {
    showShips: true,
    ships: playerShips,
  });

  updateShipCounters();
}

function updateShipCounters() {
  const eSunk = enemyShips.filter(s => s.sunk).length;
  const pSunk = playerShips.filter(s => s.sunk).length;
  document.getElementById('enemy-ships-left').textContent =
    `(${SHIPS.length - eSunk}/${SHIPS.length} remaining)`;
  document.getElementById('player-ships-left').textContent =
    `(${SHIPS.length - pSunk}/${SHIPS.length} remaining)`;
}

// ── Player Shot ────────────────────────────────────────
function handlePlayerShot(row, col) {
  if (!gameActive || !isPlayerTurn) return;
  if (enemyBoard[row][col].shot) return;

  playerShots++;
  enemyBoard[row][col].shot = true;
  const coord = `${COLS[col]}${row + 1}`;

  if (enemyBoard[row][col].hasShip) {
    enemyBoard[row][col].hit = true;
    const shipId = enemyBoard[row][col].shipId;
    enemyShips[shipId].hits++;

    if (enemyShips[shipId].hits === enemyShips[shipId].size) {
      enemyShips[shipId].sunk = true;
      addLog(`You sank the enemy's ${enemyShips[shipId].name}!`, 'sunk');
      setStatus(`You sank the ${enemyShips[shipId].name}!`, 'sunk');
    } else {
      addLog(`You hit at ${coord}!`, 'player');
      setStatus('Direct hit!', 'hit');
    }

    if (enemyShips.every(s => s.sunk)) {
      gameActive = false;
      renderGameBoards();
      showGameOver(true);
      return;
    }
  } else {
    addLog(`You missed at ${coord}.`, 'player');
    setStatus('Miss...', 'miss');
  }

  isPlayerTurn = false;
  renderGameBoards();

  // AI turn after short delay
  setTimeout(aiTurn, 600);
}

// ── AI Opponent ────────────────────────────────────────
function resetAI() {
  aiMode = 'hunt';
  aiTargetQueue = [];
  aiHitStack = [];
  aiFirstHit = null;
  aiLastHit = null;
  aiDirection = null;
}

function aiTurn() {
  if (!gameActive) return;

  let row, col;

  if (aiMode === 'target' && aiTargetQueue.length > 0) {
    // Target mode: pursue adjacent cells of hits
    let target;
    do {
      target = aiTargetQueue.shift();
    } while (target && playerBoard[target[0]][target[1]].shot && aiTargetQueue.length > 0);

    if (target && !playerBoard[target[0]][target[1]].shot) {
      row = target[0];
      col = target[1];
    } else {
      // Fallback to hunt
      aiMode = 'hunt';
      aiFirstHit = null;
      aiLastHit = null;
      aiDirection = null;
      [row, col] = aiHuntPick();
    }
  } else {
    if (aiMode === 'target') {
      // Queue empty, reset to hunt
      aiMode = 'hunt';
      aiFirstHit = null;
      aiLastHit = null;
      aiDirection = null;
    }
    [row, col] = aiHuntPick();
  }

  enemyShots++;
  playerBoard[row][col].shot = true;
  const coord = `${COLS[col]}${row + 1}`;

  if (playerBoard[row][col].hasShip) {
    playerBoard[row][col].hit = true;
    const shipId = playerBoard[row][col].shipId;
    playerShips[shipId].hits++;

    if (playerShips[shipId].hits === playerShips[shipId].size) {
      playerShips[shipId].sunk = true;
      addLog(`Enemy sank your ${playerShips[shipId].name}!`, 'sunk');

      // Remove any remaining targets for this sunk ship
      const sunkCells = new Set(
        playerShips[shipId].cells.map(([r, c]) => `${r},${c}`)
      );
      aiTargetQueue = aiTargetQueue.filter(
        ([r, c]) => !sunkCells.has(`${r},${c}`)
      );

      // Check if there are still unresolved hits
      if (aiTargetQueue.length > 0) {
        aiMode = 'target';
      } else {
        aiMode = 'hunt';
        aiFirstHit = null;
        aiLastHit = null;
        aiDirection = null;
      }

      if (playerShips.every(s => s.sunk)) {
        gameActive = false;
        renderGameBoards();
        showGameOver(false);
        return;
      }
    } else {
      addLog(`Enemy hit at ${coord}!`, 'enemy');
      aiProcessHit(row, col);
    }
  } else {
    addLog(`Enemy missed at ${coord}.`, 'enemy');
    // If we were targeting in a direction and missed, try the opposite direction
    if (aiMode === 'target' && aiDirection !== null && aiFirstHit) {
      aiReverseDirection();
    }
  }

  isPlayerTurn = true;
  setStatus("Your turn — fire at the enemy's fleet!");
  renderGameBoards();
}

function aiHuntPick() {
  // Checkerboard pattern for efficiency: only target cells where (r+c)%2===0
  const candidates = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!playerBoard[r][c].shot && (r + c) % 2 === 0) {
        candidates.push([r, c]);
      }
    }
  }

  // Fallback if checkerboard exhausted
  if (candidates.length === 0) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!playerBoard[r][c].shot) {
          candidates.push([r, c]);
        }
      }
    }
  }

  // Probability density: prefer cells that could hold more unsunk ships
  const smallest = getSmallestUnsunkShipSize();
  const scored = candidates.map(([r, c]) => {
    let score = 0;
    // Count how many directions a ship of the smallest size could pass through this cell
    for (const orient of ['horizontal', 'vertical']) {
      for (let start = 0; start < smallest; start++) {
        let valid = true;
        for (let i = 0; i < smallest; i++) {
          const cr = orient === 'vertical' ? r - start + i : r;
          const cc = orient === 'horizontal' ? c - start + i : c;
          if (cr < 0 || cr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE ||
              playerBoard[cr][cc].shot) {
            valid = false;
            break;
          }
        }
        if (valid) score++;
      }
    }
    return { pos: [r, c], score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick randomly among the top scoring cells
  const maxScore = scored[0].score;
  const topCells = scored.filter(s => s.score === maxScore);
  return topCells[Math.floor(Math.random() * topCells.length)].pos;
}

function getSmallestUnsunkShipSize() {
  let min = BOARD_SIZE;
  for (const ship of playerShips) {
    if (!ship.sunk && ship.size < min) min = ship.size;
  }
  return min;
}

function aiProcessHit(row, col) {
  if (aiMode === 'hunt') {
    // First hit: switch to target mode
    aiMode = 'target';
    aiFirstHit = [row, col];
    aiLastHit = [row, col];
    aiDirection = null;
    // Add all 4 adjacent cells
    addAdjacentTargets(row, col);
  } else if (aiMode === 'target') {
    aiLastHit = [row, col];
    if (aiFirstHit && !aiDirection) {
      // Determine direction from first hit
      if (row === aiFirstHit[0]) {
        aiDirection = 'horizontal';
      } else {
        aiDirection = 'vertical';
      }
      // Clear queue and add cells along the determined direction
      aiTargetQueue = [];
      addDirectionalTargets();
    } else if (aiDirection) {
      // Continue in same direction
      addNextInDirection(row, col);
    }
  }
}

function addAdjacentTargets(row, col) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE &&
        !playerBoard[nr][nc].shot) {
      aiTargetQueue.push([nr, nc]);
    }
  }
}

function addDirectionalTargets() {
  aiTargetQueue = [];
  if (!aiFirstHit || !aiLastHit) return;

  if (aiDirection === 'horizontal') {
    // Add cells to the left and right of both hits
    const minC = Math.min(aiFirstHit[1], aiLastHit[1]);
    const maxC = Math.max(aiFirstHit[1], aiLastHit[1]);
    const r = aiFirstHit[0];
    if (maxC + 1 < BOARD_SIZE && !playerBoard[r][maxC + 1].shot)
      aiTargetQueue.push([r, maxC + 1]);
    if (minC - 1 >= 0 && !playerBoard[r][minC - 1].shot)
      aiTargetQueue.push([r, minC - 1]);
  } else {
    const minR = Math.min(aiFirstHit[0], aiLastHit[0]);
    const maxR = Math.max(aiFirstHit[0], aiLastHit[0]);
    const c = aiFirstHit[1];
    if (maxR + 1 < BOARD_SIZE && !playerBoard[maxR + 1][c].shot)
      aiTargetQueue.push([maxR + 1, c]);
    if (minR - 1 >= 0 && !playerBoard[minR - 1][c].shot)
      aiTargetQueue.push([minR - 1, c]);
  }
}

function addNextInDirection(row, col) {
  if (aiDirection === 'horizontal') {
    if (col + 1 < BOARD_SIZE && !playerBoard[row][col + 1].shot)
      aiTargetQueue.unshift([row, col + 1]);
    if (col - 1 >= 0 && !playerBoard[row][col - 1].shot)
      aiTargetQueue.push([row, col - 1]);
  } else {
    if (row + 1 < BOARD_SIZE && !playerBoard[row + 1][col].shot)
      aiTargetQueue.unshift([row + 1, col]);
    if (row - 1 >= 0 && !playerBoard[row - 1][col].shot)
      aiTargetQueue.push([row - 1, col]);
  }
}

function aiReverseDirection() {
  if (!aiFirstHit) return;
  aiTargetQueue = [];
  if (aiDirection === 'horizontal') {
    const minC = Math.min(aiFirstHit[1], aiLastHit ? aiLastHit[1] : aiFirstHit[1]);
    const maxC = Math.max(aiFirstHit[1], aiLastHit ? aiLastHit[1] : aiFirstHit[1]);
    const r = aiFirstHit[0];
    // Try extending from the first hit in the opposite direction
    for (let c = minC - 1; c >= 0; c--) {
      if (playerBoard[r][c].shot) break;
      aiTargetQueue.push([r, c]);
      break;
    }
    for (let c = maxC + 1; c < BOARD_SIZE; c++) {
      if (playerBoard[r][c].shot) break;
      aiTargetQueue.push([r, c]);
      break;
    }
  } else {
    const minR = Math.min(aiFirstHit[0], aiLastHit ? aiLastHit[0] : aiFirstHit[0]);
    const maxR = Math.max(aiFirstHit[0], aiLastHit ? aiLastHit[0] : aiFirstHit[0]);
    const c = aiFirstHit[1];
    for (let r = minR - 1; r >= 0; r--) {
      if (playerBoard[r][c].shot) break;
      aiTargetQueue.push([r, c]);
      break;
    }
    for (let r = maxR + 1; r < BOARD_SIZE; r++) {
      if (playerBoard[r][c].shot) break;
      aiTargetQueue.push([r, c]);
      break;
    }
  }

  if (aiTargetQueue.length === 0) {
    aiMode = 'hunt';
    aiFirstHit = null;
    aiLastHit = null;
    aiDirection = null;
  }
}

// ── Game Log ───────────────────────────────────────────
function addLog(msg, type) {
  const entries = document.getElementById('log-entries');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}-log`;
  entry.textContent = msg;
  entries.prepend(entry);
}

// ── Status ─────────────────────────────────────────────
function setStatus(msg, type) {
  const el = document.getElementById('status-message');
  el.textContent = msg;
  el.className = '';
  if (type === 'hit') el.className = 'hit-msg';
  else if (type === 'miss') el.className = 'miss-msg';
  else if (type === 'sunk') el.className = 'sunk-msg';
}

// ── Game Over ──────────────────────────────────────────
function showGameOver(playerWon) {
  const modal = document.getElementById('game-over-modal');
  const title = document.getElementById('game-over-title');
  const stats = document.getElementById('game-over-stats');

  modal.classList.remove('hidden');
  if (playerWon) {
    title.textContent = 'VICTORY!';
    title.className = 'win';
    stats.textContent = `You destroyed the enemy fleet in ${playerShots} shots.`;
  } else {
    title.textContent = 'DEFEAT';
    title.className = 'lose';
    stats.textContent = `The enemy destroyed your fleet. You fired ${playerShots} shots.`;
  }
}

// ── Reset ──────────────────────────────────────────────
function resetGame() {
  document.getElementById('game-over-modal').classList.add('hidden');
  document.getElementById('game-phase').classList.add('hidden');
  document.getElementById('setup-phase').classList.remove('hidden');
  gameActive = false;
  initSetupPhase();
}

// ── Event Listeners ────────────────────────────────────
document.getElementById('rotate-btn').addEventListener('click', () => {
  placementOrientation = placementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
  document.getElementById('rotate-btn').textContent =
    placementOrientation === 'horizontal' ? '↻ Rotate (R)' : '↻ Rotate (R)';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    if (!gameActive) {
      placementOrientation = placementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    }
  }
});

document.getElementById('random-btn').addEventListener('click', () => {
  randomPlacement(playerBoard, playerShips);
  placedShips = new Set(SHIPS.map((_, i) => i));
  selectedShipIndex = null;
  renderShipList();
  renderSetupBoard();
  updateStartButton();
});

document.getElementById('clear-btn').addEventListener('click', () => {
  initSetupPhase();
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', resetGame);

// ── Init ───────────────────────────────────────────────
initSetupPhase();
