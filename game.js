'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Intervalo de caída (ms): inicial, reducción por nivel y mínimo
const DIFFICULTIES = {
  easy:      { start: 1200, step: 60, min: 250 },
  medium:    { start: 1000, step: 90, min: 100 },
  nightmare: { start: 450,  step: 40, min: 50 },
};

const canvas = document.getElementById('board');
const difficultyEl = document.getElementById('difficulty');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-btn');

let difficulty = 'medium';
let theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
let gridColor;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, runBestCombo;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  trackCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = calcDropInterval();
    updateHUD();
  }
}

function calcDropInterval() {
  const d = DIFFICULTIES[difficulty];
  return Math.max(d.min, d.start - (level - 1) * d.step);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  try { localStorage.setItem('theme', theme); } catch (e) { /* almacenamiento no disponible */ }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  combo = 0;
  runBestCombo = 0;
  hideRecordsUI();
  dropInterval = calcDropInterval();
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeBtn.addEventListener('click', () => {
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  draw(); // en pausa o game over el loop no repinta
});

difficultyEl.addEventListener('click', e => {
  const btn = e.target.closest('button[data-difficulty]');
  if (!btn) return;
  btn.blur(); // evita que Space/flechas vuelvan a activar el botón
  if (btn.dataset.difficulty === difficulty) return;
  difficulty = btn.dataset.difficulty;
  difficultyEl.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b === btn));
  if (onStartScreen) return; // init() arrancaría la partida sin pulsar Jugar; init ya usa la dificultad elegida
  init();
});


// ---- Tabla de records (localStorage 'tetris.records') ----
const RECORDS_KEY = 'tetris.records';
const MAX_TOP = 5;
const recordsPanel = document.getElementById('records-panel');
const recordsBody = document.getElementById('records-body');
const recordsStats = document.getElementById('records-stats');
const gameoverPanel = document.getElementById('gameover-panel');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
let onStartScreen = false;
let pendingScore = 0;
let highlightIndex = -1;

function loadRecords() {
  const rec = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.top)) {
      rec.top = data.top
        .filter(t => t && Number.isFinite(t.score))
        .slice(0, MAX_TOP)
        .map(t => ({ name: String(t.name ?? '').slice(0, 10), score: t.score, date: String(t.date ?? '') }));
    }
    if (data && Number.isFinite(data.bestCombo)) rec.bestCombo = data.bestCombo;
    if (data && Number.isFinite(data.maxLines)) rec.maxLines = data.maxLines;
  } catch (e) { /* almacenamiento no disponible o datos corruptos */ }
  return rec;
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) { /* almacenamiento no disponible */ }
}

function renderRecords() {
  const rec = loadRecords();
  recordsBody.textContent = '';
  for (let i = 0; i < MAX_TOP; i++) {
    const t = rec.top[i];
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.className = 'new-record';
    const cells = [String(i + 1), t ? t.name : '-', t ? t.score.toLocaleString() : '-', t && t.date ? t.date.slice(0, 10) : '-'];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    recordsBody.appendChild(tr);
  }
  recordsStats.textContent = `Mejor combo: ${rec.bestCombo} · Líneas máximas: ${rec.maxLines}`;
  recordsPanel.classList.remove('hidden');
}

function hideRecordsUI() {
  recordsPanel.classList.add('hidden');
  gameoverPanel.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar';
  highlightIndex = -1;
  onStartScreen = false;
}

function showStartScreen() {
  gameOver = true; // bloquea atajos y pausa hasta pulsar Jugar
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  onStartScreen = true;
  highlightIndex = -1;
  renderRecords();
  overlay.classList.remove('hidden');
}

function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, runBestCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  highlightIndex = -1;
  pendingScore = score;
  const qualifies = score > 0 && (rec.top.length < MAX_TOP || score > rec.top[rec.top.length - 1].score);
  gameoverPanel.classList.toggle('hidden', !qualifies);
  if (qualifies) {
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 0);
  }
  renderRecords();
}

function trackCombo(cleared) {
  combo = cleared ? combo + 1 : 0;
  if (combo > runBestCombo) runBestCombo = combo;
}

function submitRecordName() {
  const rec = loadRecords();
  const name = nameInput.value.trim().slice(0, 10) || 'Anónimo';
  const entry = { name, score: pendingScore, date: new Date().toISOString() };
  rec.top.push(entry);
  rec.top.sort((a, b) => b.score - a.score);
  highlightIndex = rec.top.indexOf(entry);
  rec.top = rec.top.slice(0, MAX_TOP);
  if (highlightIndex >= MAX_TOP) highlightIndex = -1;
  saveRecords(rec);
  gameoverPanel.classList.add('hidden');
  renderRecords();
}

saveNameBtn.addEventListener('click', () => { saveNameBtn.blur(); submitRecordName(); });
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitRecordName(); });
restartBtn.addEventListener('click', () => restartBtn.blur()); // Space no debe reactivar el botón
resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Resetear todos los records?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* almacenamiento no disponible */ }
  highlightIndex = -1;
  gameoverPanel.classList.add('hidden');
  renderRecords();
});

applyTheme();
init();
showStartScreen();
