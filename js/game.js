/* ========================================
   SPOON MAN v2.0 - ОСНОВНАЯ ЛОГИКА ИГРЫ
   ======================================== */

// ========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CELL = GAME_CONFIG.cellSize;
const W = GAME_CONFIG.mapWidth;
const H = GAME_CONFIG.mapHeight;

// ИСПРАВЛЕНИЕ: Обновляем размер канваса под новую карту
canvas.width = W * CELL;
canvas.height = H * CELL;

let gamePaused = false;
let gameStartTime = Date.now();
let gameTime = 0;
let timerInterval = null;
let bestScores = JSON.parse(localStorage.getItem('spoonman_best_scores')) || [];
let totalKills = 0;
let playerTeleporting = false;
let teleportPhase = 0; // 0 = normal, 1 = fading out, 2 = fading in
let levelStartTime = 0;

// Состояние игры
let g = {
  state: 'playing',
  level: 1,
  score: 0,
  p: {
    x: 1, y: 1, tx: 1, ty: 1,
    bombs: PLAYER_CONFIG.startBombs,
    range: PLAYER_CONFIG.startRange,
    speed: PLAYER_CONFIG.startSpeed,
    speedLvl: 1,
    det: false
  },
  bots: [],
  bombs: [],
  exps: [],
  pups: [],
  parts: [],
  grid: [],
  doorVis: false,
  doorPos: null,
  keys: {},
  lastMove: 0,
  combo: 0,
  lastKillTime: 0
};

// ========================================
// ТАЙМЕР ИГРЫ
// ========================================
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  levelStartTime = Date.now();
  
  timerInterval = setInterval(() => {
    if (!gamePaused && g.state === 'playing') {
      gameTime = Math.floor((Date.now() - levelStartTime) / 1000);
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(gameTime / 60);
  const seconds = gameTime % 60;
  document.getElementById('gameTimer').textContent = 
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ========================================
// ГЕНЕРАЦИЯ УРОВНЯ С ИСЧЕЗАЮЩИМИ СТЕНАМИ
// ========================================
function generateLevel() {
  const gr = Array(H).fill(0).map(() => Array(W).fill(0));
  
  // НОВОЕ: Определяем количество слоёв стен
  const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
  // СЛУЧАЙНЫЙ ПАТТЕРН ПОСЛЕ 5 УРОВНЯ
let pattern;
if (WALL_CONFIG.patterns[g.level]) {
  pattern = WALL_CONFIG.patterns[g.level];
} else {
  // Случайный выбор из всех паттернов
  const allPatterns = ['classic', 'diagonal', 'sparse', 'checkerboard', 'random'];
  pattern = allPatterns[~~(Math.random() * allPatterns.length)];
}
  
// СЛОИ ГРАНИЦ (0, 1, 2 или 3 слоя)
for (let layer = 0; layer < layers; layer++) {
  for (let y = layer; y < H - layer; y++) {
    for (let x = layer; x < W - layer; x++) {
      // Внешний периметр каждого слоя
      if (x === layer || y === layer || x === W - 1 - layer || y === H - 1 - layer) {
        gr[y][x] = 1; // Неразрушаемая стена
      }
    }
  }
}
  
  // ВНУТРЕННИЕ НЕРАЗРУШАЕМЫЕ БЛОКИ (разные паттерны)
  const startOffset = layers; // Начинаем после границ
  
  if (pattern === 'classic') {
    // Классическая сетка (как раньше)
    for (let y = startOffset; y < H - startOffset; y++) {
      for (let x = startOffset; x < W - startOffset; x++) {
        if (x % 2 === 0 && y % 2 === 0) {
          gr[y][x] = 1;
        }
      }
    }
  } else if (pattern === 'diagonal') {
    // Диагональные линии
    for (let y = startOffset; y < H - startOffset; y++) {
      for (let x = startOffset; x < W - startOffset; x++) {
        if ((x + y) % 3 === 0) {
          gr[y][x] = 1;
        }
      }
    }
} else if (pattern === 'sparse') {
  // НОВЫЙ: Редкие блоки (больше пространства)
  for (let y = startOffset; y < H - startOffset; y++) {
    for (let x = startOffset; x < W - startOffset; x++) {
      if (x % 3 === 0 && y % 3 === 0) {
        gr[y][x] = 1;
      }
    }
  }
} else if (pattern === 'checkerboard') {
  // НОВЫЙ: Шахматная доска
  for (let y = startOffset; y < H - startOffset; y++) {
    for (let x = startOffset; x < W - startOffset; x++) {
      if ((x + y) % 4 === 0) {
        gr[y][x] = 1;
      }
    }
  }
} else if (pattern === 'cross') {
  // Кресты (оставляем как есть для других уровней)
  const centerX = Math.floor(W / 2);
  const centerY = Math.floor(H / 2);
  for (let y = startOffset; y < H - startOffset; y++) {
    for (let x = startOffset; x < W - startOffset; x++) {
      if ((x === centerX || y === centerY) && (x % 2 === 0 || y % 2 === 0)) {
        gr[y][x] = 1;
      }
    }
  }
  } else if (pattern === 'maze') {
    // Лабиринт (более плотная сетка)
    for (let y = startOffset; y < H - startOffset; y++) {
      for (let x = startOffset; x < W - startOffset; x++) {
        if ((x % 3 === 0 && y % 2 === 0) || (x % 2 === 0 && y % 3 === 0)) {
          gr[y][x] = 1;
        }
      }
    }
  } else if (pattern === 'random') {
    // Случайные блоки (но не слишком много)
    for (let y = startOffset; y < H - startOffset; y++) {
      for (let x = startOffset; x < W - startOffset; x++) {
        if (Math.random() < 0.15 && x % 2 === 0 && y % 2 === 0) {
          gr[y][x] = 1;
        }
      }
    }
  }
  
  // ДИНАМИЧЕСКАЯ ПЛОТНОСТЬ СТЕН
  const wallChance = LEVEL_CONFIG.wallDensity[g.level] || LEVEL_CONFIG.wallDensity.default;
  
  /// Разрушаемые стены (БЕЗ мёртвых зон!)
for (let y = startOffset; y < H - startOffset; y++) {
  for (let x = startOffset; x < W - startOffset; x++) {
    const isStartZone = (x < startOffset + 3) && (y < startOffset + 3);
    
    if (gr[y][x] === 0 && !isStartZone && Math.random() < wallChance) {
      // Проверка: есть ли доступ с хотя бы 1 стороны?
      const neighbors = [
        [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
        [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1] // Диагонали
      ];
      
      const hasAccess = neighbors.some(([nx, ny]) => {
        if (nx < startOffset || nx >= W - startOffset || 
            ny < startOffset || ny >= H - startOffset) return false;
        return gr[ny][nx] === 0;
      });
      
      if (hasAccess) {
        gr[y][x] = 2;
      }
    }
  }
}
  
  // Создаём выход
  const doorCandidates = [];
  for (let y = startOffset; y < H - startOffset; y++) {
    for (let x = startOffset; x < W - startOffset; x++) {
      if (gr[y][x] === 2) doorCandidates.push({ x, y });
    }
  }
  
  if (doorCandidates.length) {
    const door = doorCandidates[~~(Math.random() * doorCandidates.length)];
    gr[door.y][door.x] = 3;
    g.doorPos = door;
  }
  
  return gr;
}

// ========================================
// ГЕНЕРАЦИЯ ВРАГОВ (ИСПРАВЛЕНО)
// ========================================
function generateBots() {
  const level = Math.min(g.level, 4);
  const config = ENEMY_CONFIG.levelConfig[level] || ENEMY_CONFIG.levelConfig.default;
  const bots = [];
  
  // НОВОЕ: Определяем стартовую зону игрока динамически
  const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
  const playerStartX = layers + 1;
  const playerStartY = layers + 1;
  const safeZoneSize = 5; // Размер безопасной зоны вокруг игрока
  
  config.forEach(({ type, count }) => {
    const enemyType = ENEMY_CONFIG.types[type];
    
    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0;
      
      do {
        // Генерируем в пределах игрового поля (без учёта стен)
        x = ~~(Math.random() * (W - layers * 2 - 2)) + layers + 1;
        y = ~~(Math.random() * (H - layers * 2 - 2)) + layers + 1;
        attempts++;
      } while (
        (g.grid[y][x] !== 0 || // Не пустая клетка
        (Math.abs(x - playerStartX) < safeZoneSize && Math.abs(y - playerStartY) < safeZoneSize) || // В зоне игрока
        bots.some(b => b.x === x && b.y === y)) && // Уже занято ботом
        attempts < 100
      );
      
      if (attempts < 100) {
        bots.push({
          id: Date.now() + Math.random(),
          x, y, tx: x, ty: y,
          type: type,
          spd: enemyType.speed,
          lm: 0,
          lb: 0,
          dir: null,
          color: enemyType.color
        });
      }
    }
  });
  
  return bots;
}

// ========================================
// ИНИЦИАЛИЗАЦИЯ ИГРЫ
// ========================================
function init() {
  // ИСПРАВЛЕНИЕ: Очищаем ВСЕ таймеры (и setTimeout и setInterval)
  g.bombs.forEach(b => {
    if (b.timer) {
      clearTimeout(b.timer);
      clearInterval(b.timer);
    }
  });
  
  g.grid = generateLevel();
  
  // ИСПРАВЛЕНИЕ: Стартовая позиция ПОСЛЕ слоёв стен
  const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
  const startX = layers + 1;
  const startY = layers + 1;
  
  g.p.x = g.p.tx = startX;
  g.p.y = g.p.ty = startY;

  // ИСПРАВЛЕНИЕ: Если игрок попал на стену - ищем ближайшую свободную клетку
if (g.grid[startY][startX] !== 0) {
  // Ищем первую свободную клетку
  let found = false;
  for (let y = startY; y < H && !found; y++) {
    for (let x = startX; x < W && !found; x++) {
      if (g.grid[y][x] === 0) {
        g.p.x = g.p.tx = x;
        g.p.y = g.p.ty = y;
        found = true;
      }
    }
  }
}
  
  g.bombs = [];
  g.exps = [];
  g.pups = [];
  g.parts = [];
  g.doorVis = false;
  g.state = 'playing';
  g.combo = 0;
  g.bots = generateBots();
  g.lastMove = 0;
  
  // Сброс таймера на каждом уровне
if (timerInterval) clearInterval(timerInterval);
gameTime = 0;
startTimer();

  updateUI();
  updateDetonatorIndicator();
}


// ========================================
// ПРОВЕРКА ВОЗМОЖНОСТИ ДВИЖЕНИЯ (ИСПРАВЛЕНО)
// ========================================
function canMove(x, y, isBot = false) {
  // ТЕЛЕПОРТАЦИЯ: Разрешаем выход за границы карты
  const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
  const teleportActive = layers === 0 && WALL_CONFIG.teleportEnabled;
  
  // Если вышли за границы И телепортация включена - разрешаем (телепортация обработается отдельно)
  if (teleportActive && (x < 0 || x >= W || y < 0 || y >= H)) {
    return true; // Разрешаем только выход ЗА карту
  }
  
  // Обычная проверка границ (без телепортации)
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  
  // ✅ ВСЕГДА проверяем коллизии с блоками внутри карты
  const cell = g.grid[y][x];
  
  if (cell === 1 || cell === 2) return false; // Стены
  if (!isBot && cell === 3 && !g.doorVis) return false; // Закрытая дверь
  if (isBot && cell === 3) return false; // Боты не могут в дверь
  if (g.bombs.some(b => !b.ex && b.x === x && b.y === y)) return false; // Бомбы
  
  return true;
}

// ========================================
// ТЕЛЕПОРТАЦИЯ (новая функция)
// ========================================
function teleport(x, y) {
  let newX = x;
  let newY = y;
  
  // Телепортация по горизонтали
  if (x < 0) newX = W - 1;
  if (x >= W) newX = 0;
  
  // Телепортация по вертикали
  if (y < 0) newY = H - 1;
  if (y >= H) newY = 0;
  
  return { x: newX, y: newY };
}

// ========================================
// УСТАНОВКА БОМБЫ
// ========================================
function placeBomb(x, y, isBot = false) {
  if (!isBot && g.bombs.filter(b => !b.ex && !b.bot).length >= g.p.bombs) return;
  if (g.bombs.some(b => b.x === x && b.y === y)) return;
  
  for (let i = 0; i < 8; i++) {
    g.parts.push({
      x: x * CELL + CELL / 2,
      y: y * CELL + CELL / 2,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 20,
      col: '#ffffff',
      size: 2
    });
  }
  
  const bomb = {
    id: Date.now() + Math.random(),
    x, y,
    r: g.p.range,
    t: Date.now(),
    ex: false,
    bot: isBot,
    det: !isBot && g.p.det,
    timer: null  // НОВОЕ: Храним ссылку на таймер
  };
  
  g.bombs.push(bomb);
  
  // ИСПРАВЛЕНИЕ: Сохраняем ID таймера чтобы можно было отменить
  if (!bomb.det) {
  // Запускаем интервал проверки вместо простого таймера
  bomb.startTime = Date.now();
  bomb.pausedTime = 0;
  bomb.timer = setInterval(() => {
    if (!gamePaused) {
      const elapsed = Date.now() - bomb.startTime - bomb.pausedTime;
      if (elapsed >= BOMB_CONFIG.fuseTime) {
        clearInterval(bomb.timer);
        explodeBomb(bomb);
      }
    }
  }, 50); // Проверяем каждые 50мс
}
}

// ========================================
// ДЕТОНАЦИЯ ВСЕХ УПРАВЛЯЕМЫХ БОМБ
// ========================================
function detonateAll() {
  g.bombs.filter(b => b.det && !b.ex).forEach(b => explodeBomb(b));
}

// ========================================
// ВЗРЫВ БОМБЫ
// ========================================
function explodeBomb(bomb) {
  if (bomb.ex) return;
  
  bomb.ex = true;
  const cells = getExplosionCells(bomb.x, bomb.y, bomb.r);
  g.exps.push({ id: bomb.id, cs: cells, t: Date.now() });
  
  for (let i = 0; i < BOMB_CONFIG.particleCount; i++) {
    g.parts.push({
      x: bomb.x * CELL + CELL / 2,
      y: bomb.y * CELL + CELL / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 50,
      col: ['#ff6b35', '#ffaa00', '#ff3333', '#ff9900', '#ff4400'][~~(Math.random() * 5)],
      size: Math.random() * 5 + 3
    });
  }
  
  for (let i = 0; i < BOMB_CONFIG.fireRingParticles; i++) {
    const angle = (i / BOMB_CONFIG.fireRingParticles) * Math.PI * 2;
    g.parts.push({
      x: bomb.x * CELL + CELL / 2,
      y: bomb.y * CELL + CELL / 2,
      vx: Math.cos(angle) * 3,
      vy: Math.sin(angle) * 3,
      life: 40,
      col: '#ff3300',
      size: 4
    });
  }
  
  cells.forEach(({ x, y }) => {
    const cellType = g.grid[y][x];
    
    if (cellType === 2) {
      g.grid[y][x] = 0;
      g.score += SCORING_CONFIG.destroyWall;
      
      for (let i = 0; i < 15; i++) {
        g.parts.push({
          x: x * CELL + CELL / 2,
          y: y * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 30,
          col: '#ffcc00',
          size: Math.random() * 4 + 2
        });
      }
      
      if (Math.random() < LEVEL_CONFIG.powerupDropChance) {
        const types = ['bomb', 'range', 'speed'];
        if (Math.random() < LEVEL_CONFIG.detonatorChance && !g.p.det) {
          types.push('det');
        }
        g.pups.push({
          id: Date.now() + Math.random(),
          x, y,
          t: types[~~(Math.random() * types.length)],
          pulse: 0
        });
      }
    }
    
    if (cellType === 3) {
      g.doorVis = true;
      
      for (let i = 0; i < 25; i++) {
        g.parts.push({
          x: x * CELL + CELL / 2,
          y: y * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 40,
          col: '#ffd700',
          size: Math.random() * 3 + 2
        });
      }
    }
  });
  
  if (cells.some(c => c.x === g.p.x && c.y === g.p.y)) {
    g.state = 'lose';
    showModal('ПОРАЖЕНИЕ', g.score, 'ЗАНОВО', restart);
  }
  
  if (!bomb.bot && COMBO_CONFIG.enabled) {
    const killedBots = g.bots.filter(b => cells.some(c => c.x === b.x && c.y === b.y));
    const now = Date.now();
    
    if (killedBots.length > 0) {
      if (now - g.lastKillTime < COMBO_CONFIG.timeWindow) {
        g.combo++;
      } else {
        g.combo = 1;
      }
      g.lastKillTime = now;
      
      const comboBonus = g.combo > 1 ? g.combo * COMBO_CONFIG.bonusPerCombo : 0;
      const killPoints = killedBots.length * (SCORING_CONFIG.killEnemy + comboBonus);
      
      g.score += killPoints;
      totalKills += killedBots.length;
      g.bots = g.bots.filter(b => !cells.some(c => c.x === b.x && c.y === b.y));
      
      if (g.combo > 1 && COMBO_CONFIG.showComboText) {
        createComboText(bomb.x * CELL + CELL / 2, bomb.y * CELL - 20, `x${g.combo} COMBO!`);
      }
    }
  }
  
  if (BOMB_CONFIG.chainReaction) {
    g.bombs.filter(b => !b.ex && b.id !== bomb.id).forEach(otherBomb => {
      if (cells.some(c => c.x === otherBomb.x && c.y === otherBomb.y)) {
        setTimeout(() => explodeBomb(otherBomb), BOMB_CONFIG.chainReactionDelay);
      }
    });
  }
  
  updateUI();
  
  setTimeout(() => {
    g.exps = g.exps.filter(e => e.id !== bomb.id);
    g.bombs = g.bombs.filter(b => b.id !== bomb.id);
  }, BOMB_CONFIG.explosionDuration);
}

// ========================================
// ПОЛУЧИТЬ ЯЧЕЙКИ ВЗРЫВА
// ========================================
function getExplosionCells(x, y, range) {
  const cells = [{ x, y }];
  
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
    for (let i = 1; i <= range; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      
      if (nx < 0 || nx >= W || ny < 0 || ny >= H || g.grid[ny][nx] === 1) break;
      
      cells.push({ x: nx, y: ny });
      
      if (g.grid[ny][nx] === 2 || g.grid[ny][nx] === 3) break;
    }
  });
  
  return cells;
}

// ========================================
// ОБНОВЛЕНИЕ ИГРОКА
// ========================================
function updatePlayer() {
  // Блокировка во время анимаций
  if (playerTeleporting || g.state === 'entering_door') {
    if (VISUAL_CONFIG.smoothMovement) {
      if (g.p.x !== g.p.tx) {
        g.p.x += (g.p.tx - g.p.x) / VISUAL_CONFIG.smoothFactor;
        if (Math.abs(g.p.tx - g.p.x) < 0.01) g.p.x = g.p.tx;
      }
      if (g.p.y !== g.p.ty) {
        g.p.y += (g.p.ty - g.p.y) / VISUAL_CONFIG.smoothFactor;
        if (Math.abs(g.p.ty - g.p.y) < 0.01) g.p.y = g.p.ty;
      }
    }
    return;
  }
  
  if (g.state !== 'playing' || gamePaused) return;
  
  if (VISUAL_CONFIG.smoothMovement) {
    if (g.p.x !== g.p.tx) {
      g.p.x += (g.p.tx - g.p.x) / VISUAL_CONFIG.smoothFactor;
      if (Math.abs(g.p.tx - g.p.x) < 0.01) g.p.x = g.p.tx;
    }
    if (g.p.y !== g.p.ty) {
      g.p.y += (g.p.ty - g.p.y) / VISUAL_CONFIG.smoothFactor;
      if (Math.abs(g.p.ty - g.p.y) < 0.01) g.p.y = g.p.ty;
    }
  }
  
  const now = Date.now();
  if (now - g.lastMove < g.p.speed) return;
  if (g.p.x !== g.p.tx || g.p.y !== g.p.ty) return;
  
  let dx = 0, dy = 0;
  if (g.keys['ArrowUp'] || g.keys['w'] || g.keys['W']) dy = -1;
  if (g.keys['ArrowDown'] || g.keys['s'] || g.keys['S']) dy = 1;
  if (g.keys['ArrowLeft'] || g.keys['a'] || g.keys['A']) dx = -1;
  if (g.keys['ArrowRight'] || g.keys['d'] || g.keys['D']) dx = 1;
  
  if (dx || dy) {
    let nx = Math.round(g.p.x) + dx;
    let ny = Math.round(g.p.y) + dy;
    
    // ТЕЛЕПОРТАЦИЯ С АНИМАЦИЕЙ
    const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
    if (layers === 0 && WALL_CONFIG.teleportEnabled) {
      const willTeleport = nx < 0 || nx >= W || ny < 0 || ny >= H;
      
      if (willTeleport) {
        playerTeleporting = true;
        teleportPhase = 1;
        
        // Эффект на точке выхода
        const exitX = nx < 0 ? 0 : (nx >= W ? W - 1 : nx);
        const exitY = ny < 0 ? 0 : (ny >= H ? H - 1 : ny);
        for (let i = 0; i < 20; i++) {
          g.parts.push({
            x: exitX * CELL + CELL / 2,
            y: exitY * CELL + CELL / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 35,
            col: '#00f5ff',
            size: 4
          });
        }
        
        setTimeout(() => {
          const teleported = teleport(nx, ny);
          g.p.x = g.p.tx = teleported.x;
          g.p.y = g.p.ty = teleported.y;
          teleportPhase = 2;
          
          // Эффект на точке входа
          for (let i = 0; i < 20; i++) {
            g.parts.push({
              x: g.p.x * CELL + CELL / 2,
              y: g.p.y * CELL + CELL / 2,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 35,
              col: '#00ffaa',
              size: 4
            });
          }
          
          setTimeout(() => {
            playerTeleporting = false;
            teleportPhase = 0;
          }, 200);
        }, 200);
        
        return;
      }
    }
    
    if (canMove(nx, ny)) {
      g.p.tx = nx;
      g.p.ty = ny;
      g.lastMove = now;
      
      if (PLAYER_CONFIG.trailParticles) {
        g.parts.push({
          x: g.p.x * CELL + CELL / 2,
          y: g.p.y * CELL + CELL / 2,
          vx: 0, vy: 0,
          life: 15,
          col: '#00f5ff',
          size: 3
        });
      }
      
      // Сбор бонусов
      g.pups = g.pups.filter(p => {
        if (p.x === nx && p.y === ny) {
          if (p.t === 'bomb' && g.p.bombs < PLAYER_CONFIG.maxBombs) g.p.bombs++;
          if (p.t === 'range' && g.p.range < PLAYER_CONFIG.maxRange) g.p.range++;
          if (p.t === 'speed' && g.p.speed > PLAYER_CONFIG.minSpeed) {
            g.p.speed = Math.max(PLAYER_CONFIG.minSpeed, g.p.speed - PLAYER_CONFIG.speedBoost);
            g.p.speedLvl++;
          }
          if (p.t === 'det') {
            g.p.det = true;
            updateDetonatorIndicator();
          }
          g.score += LEVEL_CONFIG.powerups[p.t].points;
          
          for (let i = 0; i < 20; i++) {
            g.parts.push({
              x: nx * CELL + CELL / 2,
              y: ny * CELL + CELL / 2,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              life: 30,
              col: '#ffffff',
              size: 3
            });
          }
          
          updateUI();
          return false;
        }
        return true;
      });
      
      // ВХОД В ДВЕРЬ С АНИМАЦИЕЙ
      if (g.doorVis && g.doorPos && nx === g.doorPos.x && ny === g.doorPos.y) {
        const isEarlyLevel = LEVEL_CONFIG.exitConditions.earlyExit.includes(g.level);
        const canExit = isEarlyLevel || g.bots.length === 0;
        
        if (canExit && g.state === 'playing') {
          g.state = 'entering_door';
          
          // Эффект входа
          for (let i = 0; i < 50; i++) {
            g.parts.push({
              x: nx * CELL + CELL / 2,
              y: ny * CELL + CELL / 2,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 60,
              col: isEarlyLevel ? '#00ff00' : '#ffd700',
              size: Math.random() * 8 + 2
            });
          }
          
          setTimeout(() => {
            g.state = 'win';
            g.score += g.level * LEVEL_CONFIG.levelClearBonus;
            showModal('ПОБЕДА!', g.score, 'ДАЛЬШЕ', () => {
              g.level++;
              init();
            });
          }, 600);
        }
      }
      
      checkBotCollision();
    }
  }
}

// ========================================
// ПРОВЕРКА СТОЛКНОВЕНИЯ С БОТОМ
// ========================================
function checkBotCollision() {
  const px = Math.round(g.p.x);
  const py = Math.round(g.p.y);
  
  if (g.bots.some(b => Math.round(b.x) === px && Math.round(b.y) === py)) {
    g.state = 'lose';
    showModal('ПОРАЖЕНИЕ', g.score, 'ЗАНОВО', restart);
  }
}

// ========================================
// ПРОСТОЙ PATHFINDING ДЛЯ УМНЫХ БОТОВ
// ========================================
function getPathDirection(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? [1, 0] : [-1, 0];
  } else if (dy !== 0) {
    return dy > 0 ? [0, 1] : [0, -1];
  }
  return [0, 0];
}

// ========================================
// ОБНОВЛЕНИЕ БОТОВ
// ========================================
function updateBots() {
  if (g.state !== 'playing' || gamePaused) return;
  const now = Date.now();
  
  g.bots.forEach(b => {
    if (VISUAL_CONFIG.smoothMovement) {
      if (b.x !== b.tx) {
        b.x += (b.tx - b.x) / VISUAL_CONFIG.smoothFactor;
        if (Math.abs(b.tx - b.x) < 0.01) b.x = b.tx;
      }
      if (b.y !== b.ty) {
        b.y += (b.ty - b.y) / VISUAL_CONFIG.smoothFactor;
        if (Math.abs(b.ty - b.y) < 0.01) b.y = b.ty;
      }
    }
    
    if (now - b.lm < b.spd) return;
    if (b.x !== b.tx || b.y !== b.ty) return;
    
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    let dx = 0, dy = 0;
    
    if (b.type === 'smart') {
      const [px, py] = getPathDirection(bx, by, Math.round(g.p.x), Math.round(g.p.y));
      if (canMove(bx + px, by + py, true)) {
        dx = px;
        dy = py;
      } else {
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([x, y]) => canMove(bx + x, by + y, true));
        if (dirs.length) [dx, dy] = dirs[~~(Math.random() * dirs.length)];
      }
    } else if (b.type === 'bomber') {
      const dist = Math.abs(bx - g.p.x) + Math.abs(by - g.p.y);
      if (dist < 4 && now - b.lb > ENEMY_CONFIG.types.bomber.bombCooldown && Math.random() < ENEMY_CONFIG.types.bomber.bombChance) {
        placeBomb(bx, by, true);
        b.lb = now;
      }
      
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([x, y]) => canMove(bx + x, by + y, true));
      if (dirs.length) [dx, dy] = dirs[~~(Math.random() * dirs.length)];
    } else {
      if (!b.dir || Math.random() < 0.3) {
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([x, y]) => canMove(bx + x, by + y, true));
        if (dirs.length) b.dir = dirs[~~(Math.random() * dirs.length)];
      }
      if (b.dir && canMove(bx + b.dir[0], by + b.dir[1], true)) {
        [dx, dy] = b.dir;
      } else {
        b.dir = null;
      }
    }
    
if (dx || dy) {
  let targetX = bx + dx;
  let targetY = by + dy;
  
  // ТЕЛЕПОРТАЦИЯ ДЛЯ БОТОВ
  const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
  if (layers === 0 && WALL_CONFIG.teleportEnabled) {
    const teleported = teleport(targetX, targetY);
    targetX = teleported.x;
    targetY = teleported.y;
  }
  
  b.tx = targetX;
  b.ty = targetY;
  b.lm = now;
      
      setTimeout(() => {
        if (Math.round(b.x) === Math.round(g.p.x) && Math.round(b.y) === Math.round(g.p.y)) {
          g.state = 'lose';
          showModal('ПОРАЖЕНИЕ', g.score, 'ЗАНОВО', restart);
        }
      }, b.spd);
    }
  });
}

// ========================================
// СОЗДАНИЕ КОМБО-ТЕКСТА
// ========================================
function createComboText(x, y, text) {
  for (let i = 0; i < 5; i++) {
    g.parts.push({
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: -3 - Math.random() * 2,
      life: 40,
      col: '#ffcc00',
      size: 5,
      text: text,
      isText: true
    });
  }
}

// ========================================
// ОТРИСОВКА
// ========================================
function draw() {
  // ИСПРАВЛЕНИЕ: Динамический градиент под размер канваса
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0a0a12');
  gradient.addColorStop(0.5, '#0c0c18');
  gradient.addColorStop(1, '#080810');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Сетка
  if (VISUAL_CONFIG.gridLines.enabled) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${VISUAL_CONFIG.gridLines.opacity})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(canvas.width, y * CELL);
      ctx.stroke();
    }
  }
  
  // Стены и блоки
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g.grid[y][x];
      
if (c === 1) {
  // НОВОЕ: Разные цвета для разных слоёв стен
  const layers = WALL_CONFIG.borderLayers[g.level] || WALL_CONFIG.borderLayers.default;
  const isBorder = x < layers || y < layers || x >= W - layers || y >= H - layers;
  
  let color1 = '#2a2a3e';
  let color2 = '#1c1c2c';
  
  if (isBorder) {
    // Внешние стены - темнее
    color1 = '#1a1a2e';
    color2 = '#0c0c1c';
  }
  
  if (VISUAL_CONFIG.gradients) {
    const grd = ctx.createLinearGradient(x * CELL, y * CELL, x * CELL + CELL, y * CELL + CELL);
    grd.addColorStop(0, color1);
    grd.addColorStop(1, color2);
    ctx.fillStyle = grd;
        } else {
          ctx.fillStyle = '#2a2a3e';
        }
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x * CELL + 5 + i * 10, y * CELL + 5, 6, CELL - 10);
        }
      } else if (c === 2) {
        ctx.fillStyle = '#3a2819';
        ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        
        ctx.fillStyle = '#4a3829';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x * CELL + 6 + i * 12, y * CELL + 6, 8, CELL - 12);
        }
        
        ctx.strokeStyle = '#5a4839';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
      } else if (c === 3) {
        if (g.doorVis) {
          // ВОРОТА ОТКРЫТЫ
          const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
          const isEarlyLevel = LEVEL_CONFIG.exitConditions.earlyExit.includes(g.level);
          
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
          
          ctx.fillStyle = `rgba(255, 215, 0, ${0.6 * pulse})`;
          ctx.shadowBlur = 30 * pulse;
          ctx.shadowColor = '#ffd700';
          ctx.fillRect(x * CELL + 8, y * CELL + 8, CELL - 16, CELL - 16);
          ctx.shadowBlur = 0;
          
          ctx.strokeStyle = isEarlyLevel ? '#00ff00' : '#ffd700';
          ctx.lineWidth = 3;
          ctx.strokeRect(x * CELL + 5, y * CELL + 5, CELL - 10, CELL - 10);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(isEarlyLevel ? '⬇' : '👑', x * CELL + CELL / 2, y * CELL + CELL / 2);
          
        } else {
          // ВОРОТА ЗАКРЫТЫ (БЕЗ ЗАМКА!)
          ctx.fillStyle = '#3a2819';
          ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
          
          ctx.fillStyle = '#4a3829';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x * CELL + 6 + i * 12, y * CELL + 6, 8, CELL - 12);
          }
          
          ctx.strokeStyle = '#5a4839';
          ctx.lineWidth = 2;
          ctx.strokeRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }
  }
  
  // Бонусы
  g.pups.forEach(p => {
    p.pulse = (p.pulse || 0) + 0.1;
    const col = LEVEL_CONFIG.powerups[p.t].color;
    const size = CELL / 4 + Math.sin(p.pulse) * 2;
    
    ctx.save();
    ctx.translate(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2);
    if (VISUAL_CONFIG.powerupAnimation.rotation) ctx.rotate(p.pulse / 2);
    
    if (VISUAL_CONFIG.powerupAnimation.glow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = col;
    }
    ctx.fillStyle = col;
    
    if (p.t === 'bomb') drawHexagon(0, 0, size);
    else if (p.t === 'range') drawDiamond(0, 0, size);
    else if (p.t === 'speed') drawTriangle(0, 0, size);
    else drawStar(0, 0, size);
    
    ctx.restore();
    ctx.shadowBlur = 0;
  });
  
  // Частицы
  if (VISUAL_CONFIG.particles.enabled) {
    g.parts = g.parts.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.vx *= VISUAL_CONFIG.particles.fadeSpeed;
      p.vy *= VISUAL_CONFIG.particles.fadeSpeed;
      
      if (p.life > 0) {
        ctx.globalAlpha = Math.min(p.life / 30, 1);
        
        if (p.isText) {
          ctx.font = 'bold 16px Arial';
          ctx.fillStyle = p.col;
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.fillStyle = p.col;
          if (VISUAL_CONFIG.shadows) {
            ctx.shadowBlur = 5;
            ctx.shadowColor = p.col;
          }
          
          ctx.beginPath();
          if (Math.random() > 0.5) {
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          } else {
            ctx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        ctx.globalAlpha = 1;
        return true;
      }
      return false;
    });
  }
  
  // Взрывы
  g.exps.forEach(e => {
    const age = Date.now() - e.t;
    const progress = Math.min(age / BOMB_CONFIG.explosionDuration, 1);
    const alpha = 1 - progress;
    const scale = 0.8 + progress * 0.6;
    
    e.cs.forEach(({ x, y }) => {
      ctx.globalAlpha = alpha * 0.8;
      
      if (VISUAL_CONFIG.gradients) {
        const grd = ctx.createRadialGradient(
          x * CELL + CELL / 2, y * CELL + CELL / 2, 0,
          x * CELL + CELL / 2, y * CELL + CELL / 2, CELL / 2 * scale
        );
        grd.addColorStop(0, '#ff6b35');
        grd.addColorStop(0.7, '#ff3300');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = '#ff6b35';
      }
      
      if (VISUAL_CONFIG.shadows) {
        ctx.shadowBlur = 40 * alpha;
        ctx.shadowColor = '#ff6b35';
      }
      ctx.fillRect(x * CELL + CELL / 2 - CELL / 2 * scale, y * CELL + CELL / 2 - CELL / 2 * scale, CELL * scale, CELL * scale);
      
      ctx.globalAlpha = alpha * 0.4;
      ctx.beginPath();
      ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, (CELL / 2) * scale * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });
  
  // Бомбы
g.bombs.forEach(b => {
  if (!b.ex) {
    // ИСПРАВЛЕНИЕ: Учитываем время паузы
    let elapsed;
    if (b.det) {
      elapsed = 0; // Детонируемые бомбы не имеют таймера
    } else if (b.startTime) {
      // Новая система с учётом паузы
      elapsed = Date.now() - b.startTime - (b.pausedTime || 0);
      if (gamePaused && b.pauseStart) {
        elapsed -= (Date.now() - b.pauseStart);
      }
    } else {
      // Старая система (для обратной совместимости)
      elapsed = Date.now() - b.t;
    }
    
    const timeLeft = BOMB_CONFIG.fuseTime - elapsed;
      const pulseTime = timeLeft / BOMB_CONFIG.fuseTime;
      const pulse = 0.7 + 0.3 * Math.sin(pulseTime * Math.PI * 10);
      
      if (VISUAL_CONFIG.shadows) {
        ctx.shadowBlur = 20 * pulse;
        ctx.shadowColor = b.det ? '#ff66ff' : '#ff3333';
      }
      
      if (VISUAL_CONFIG.gradients) {
        const grd = ctx.createRadialGradient(
          b.x * CELL + CELL / 2, b.y * CELL + CELL / 2, 0,
          b.x * CELL + CELL / 2, b.y * CELL + CELL / 2, CELL / 3
        );
        
        if (b.det) {
          grd.addColorStop(0, '#ff66ff');
          grd.addColorStop(1, '#cc00cc');
        } else {
          grd.addColorStop(0, pulse > 0.8 ? '#ff4444' : '#444444');
          grd.addColorStop(1, '#222222');
        }
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = b.det ? '#ff66ff' : (pulse > 0.8 ? '#ff4444' : '#444444');
      }
      
      ctx.beginPath();
      ctx.arc(b.x * CELL + CELL / 2, b.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
      ctx.fill();
      
      if (!b.det && timeLeft < 2000) {
        const fuseHeight = 10;
        const burnProgress = 1 - (timeLeft / 2000);
        const burnedHeight = fuseHeight * burnProgress;
        const remainingHeight = fuseHeight - burnedHeight;
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(b.x * CELL + CELL / 2 - 2, b.y * CELL - 8 + burnedHeight, 4, remainingHeight);
        
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(b.x * CELL + CELL / 2, b.y * CELL - 8 + burnedHeight, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3300';
        ctx.fillStyle = '#ff9900';
        ctx.beginPath();
        ctx.arc(b.x * CELL + CELL / 2, b.y * CELL - 8 + burnedHeight, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      ctx.shadowBlur = 0;
    }
  });
  
  // Боты
  g.bots.forEach(b => {
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    
    if (g.grid[by][bx] === 0 || (g.grid[by][bx] === 3 && g.doorVis)) {
      if (ENEMY_CONFIG.shadowEffect) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.arc(b.x * CELL + CELL / 2 + 4, b.y * CELL + CELL / 2 + 4, CELL / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.fillStyle = b.color;
      if (VISUAL_CONFIG.shadows) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;
      }
      ctx.beginPath();
      ctx.arc(b.x * CELL + CELL / 2, b.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
      ctx.fill();
      
      if (ENEMY_CONFIG.eyeBlink) {
        ctx.fillStyle = '#fff';
        const eyeBlink = Math.sin(Date.now() / 1000) > 0 ? 1 : 0.3;
        ctx.globalAlpha = eyeBlink;
        ctx.beginPath();
        ctx.arc(b.x * CELL + CELL / 2 - 8, b.y * CELL + CELL / 2 - 5, 4, 0, Math.PI * 2);
        ctx.arc(b.x * CELL + CELL / 2 + 8, b.y * CELL + CELL / 2 - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      ctx.shadowBlur = 0;
    }
  });
  
// Игрок
const playerX = g.p.x * CELL + CELL / 2;
const playerY = g.p.y * CELL + CELL / 2;

// Эффект телепортации
let playerAlpha = 1;
if (teleportPhase === 1) playerAlpha = 0.2;
if (teleportPhase === 2) playerAlpha = 0.6;

ctx.globalAlpha = playerAlpha;

ctx.fillStyle = 'rgba(0,0,0,0.5)';
ctx.beginPath();
ctx.arc(playerX + 5, playerY + 5, CELL / 3 + 2, 0, Math.PI * 2);
ctx.fill();

if (VISUAL_CONFIG.gradients) {
  const playerGrd = ctx.createRadialGradient(playerX, playerY, 0, playerX, playerY, CELL / 2);
  playerGrd.addColorStop(0, '#00f5ff');
  playerGrd.addColorStop(0.7, '#0099cc');
  playerGrd.addColorStop(1, '#006688');
  ctx.fillStyle = playerGrd;
} else {
  ctx.fillStyle = '#00f5ff';
}

if (PLAYER_CONFIG.glowEffect) {
  ctx.shadowBlur = 30 * playerAlpha;
  ctx.shadowColor = '#00f5ff';
}
ctx.beginPath();
ctx.arc(playerX, playerY, CELL / 3, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = '#ffffff';
ctx.globalAlpha = 0.8 * playerAlpha;
ctx.beginPath();
ctx.arc(playerX - 6, playerY - 6, 6, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = playerAlpha;

if (g.p.det) {
  ctx.globalAlpha = (0.2 + 0.1 * Math.sin(Date.now() / 300)) * playerAlpha;
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(playerX, playerY, CELL / 3 + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

ctx.globalAlpha = 1;
ctx.shadowBlur = 0;
}

function drawHexagon(x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 2 * Math.PI / 6) - Math.PI / 2;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
}

function drawTriangle(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size / 1.5, y + size);
  ctx.lineTo(x - size / 1.5, y + size);
  ctx.closePath();
  ctx.fill();
}

function drawStar(x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    
    const innerAngle = angle + Math.PI / 5;
    const ipx = x + size / 2 * Math.cos(innerAngle);
    const ipy = y + size / 2 * Math.sin(innerAngle);
    ctx.lineTo(ipx, ipy);
  }
  ctx.closePath();
  ctx.fill();
}

function updateUI() {
  document.getElementById('level').textContent = g.level;
  document.getElementById('bots').textContent = g.bots.length;
  document.getElementById('score').textContent = g.score;
  document.getElementById('bombCount').textContent = g.p.bombs;
  document.getElementById('explosionRange').textContent = g.p.range;
  document.getElementById('speedLevel').textContent = g.p.speedLvl;
}

function updateDetonatorIndicator() {
  document.getElementById('detonatorIndicator').style.display = g.p.det ? 'block' : 'none';
}

function showModal(title, score, btnText, callback) {
  const finalScore = SCORING_CONFIG.timePenalty ? Math.max(0, score - gameTime) : score;
  
  if (title !== 'ПАУЗА') {
    bestScores.push({
      score: finalScore,
      level: g.level,
      time: gameTime,
      date: new Date().toLocaleDateString()
    });
    
    bestScores.sort((a, b) => b.score - a.score);
    bestScores = bestScores.slice(0, GAME_CONFIG.maxBestScores);
    localStorage.setItem('spoonman_best_scores', JSON.stringify(bestScores));
  }
  
  document.getElementById('modalTitle').textContent = title;
  
  let html = `ОЧКИ: ${score}<br>`;
  html += `УРОВЕНЬ: ${g.level}<br>`;
  html += `ВРЕМЯ: ${gameTime}с<br>`;
  
  if (SCORING_CONFIG.timePenalty && title !== 'ПАУЗА') {
    html += `ШТРАФ ЗА ВРЕМЯ: -${gameTime}<br>`;
    html += `<span class="final-score">ИТОГО: ${finalScore}</span>`;
  }
  
  if (title !== 'ПАУЗА') {
    html += `<br><br><div style="font-size:16px;color:#8899aa;margin-top:15px;">ЛУЧШИЕ РЕЗУЛЬТАТЫ:</div>`;
    bestScores.forEach((s, i) => {
      html += `<div style="font-size:14px;margin:5px 0;">${i + 1}. ${s.score} (ур. ${s.level}, время: ${s.time}с)</div>`;
    });
  }
  
  document.getElementById('scoreDisplay').innerHTML = html;
  document.getElementById('modalBtn').textContent = btnText;
  document.getElementById('modal').classList.add('show');
  document.getElementById('modalBtn').onclick = () => {
    document.getElementById('modal').classList.remove('show');
    callback();
  };
  
  if (title !== 'ПАУЗА' && g.state !== 'playing') {
    if (timerInterval) clearInterval(timerInterval);
  }
}

function pauseGame() {
  if (g.state !== 'playing') return;
  gamePaused = true;
  
  // ИСПРАВЛЕНИЕ: Запоминаем момент паузы для всех бомб
  const now = Date.now();
  g.bombs.forEach(b => {
    if (!b.ex && !b.det) {
      b.pauseStart = now;
    }
  });
  
  document.getElementById('pauseLevel').textContent = g.level;
  document.getElementById('pauseKills').textContent = totalKills;
  document.getElementById('pauseScore').textContent = g.score;
  
  document.getElementById('pauseMenu').classList.add('show');
}

function resumeGame() {
  // ИСПРАВЛЕНИЕ: Добавляем время паузы к каждой бомбе
  const now = Date.now();
  g.bombs.forEach(b => {
    if (!b.ex && !b.det && b.pauseStart) {
      const pauseDuration = now - b.pauseStart;
      b.pausedTime = (b.pausedTime || 0) + pauseDuration;
      b.pauseStart = null;
    }
  });
  
  gamePaused = false;
  document.getElementById('pauseMenu').classList.remove('show');
  if (!timerInterval) startTimer();
}

function restartGame() {
  restart();
}

function restart() {
  // ИСПРАВЛЕНИЕ: Останавливаем все таймеры
  g.bombs.forEach(b => {
    if (b.timer) {
      clearTimeout(b.timer);
      clearInterval(b.timer);
    }
  });
  
  gamePaused = false;
  g.level = 1;
  g.score = 0;
  totalKills = 0;
  g.p = {
    x: 1, y: 1, tx: 1, ty: 1,
    bombs: PLAYER_CONFIG.startBombs,
    range: PLAYER_CONFIG.startRange,
    speed: PLAYER_CONFIG.startSpeed,
    speedLvl: 1,
    det: false
  };
  
  if (timerInterval) clearInterval(timerInterval);
  gameTime = 0;
  gameStartTime = Date.now();
  startTimer();
  updateTimerDisplay();
  
  init();
  document.getElementById('modal').classList.remove('show');
  document.getElementById('pauseMenu').classList.remove('show');
}

window.addEventListener('keydown', e => {
  g.keys[e.key] = true;
  g.keys[e.key.toLowerCase()] = true;
  
  if (e.key === ' ' && g.state === 'playing' && !gamePaused) {
    e.preventDefault();
    placeBomb(Math.round(g.p.x), Math.round(g.p.y));
  }
  
  if ((e.key === 'e' || e.key === 'E') && g.state === 'playing' && !gamePaused && g.p.det) {
    e.preventDefault();
    detonateAll();
  }
  
  if (e.key === 'Escape') {
    e.preventDefault();
    gamePaused ? resumeGame() : pauseGame();
  }
});

window.addEventListener('keyup', e => {
  g.keys[e.key] = false;
  g.keys[e.key.toLowerCase()] = false;
});

function gameLoop() {
  if (!gamePaused) {
    updatePlayer();
    updateBots();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

startTimer();
init();
gameLoop();
