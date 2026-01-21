/* ========================================
   SPOON MAN v2.0 - КОНФИГУРАЦИЯ
   ======================================== */

const GAME_CONFIG = {
  mapWidth: 15,
  mapHeight: 12,
  cellSize: 40,
  targetFPS: 60,
  maxBestScores: 5,
  debug: false
};

const PLAYER_CONFIG = {
  startBombs: 1,
  startRange: 1,
  startSpeed: 350,
  maxBombs: 8,
  maxRange: 6,
  minSpeed: 80,
  speedBoost: 40,
  trailParticles: true,
  glowEffect: true
};

const BOMB_CONFIG = {
  fuseTime: 3000,
  explosionDuration: 500,
  chainReaction: true,
  chainReactionDelay: 100,
  blinkSpeed: 100,
  particleCount: 35,
  fireRingParticles: 16
};

const ENEMY_CONFIG = {
  types: {
    normal: {
      speed: 700,
      color: '#f44336',
      points: 50,
      spawnChance: 1.0
    },
    fast: {
      speed: 450,
      color: '#ff1744',
      points: 75,
      spawnChance: 0.7
    },
    bomber: {
      speed: 700,
      color: '#ff9800',
      points: 100,
      spawnChance: 0.5,
      bombCooldown: 3000,
      bombChance: 0.3
    },
    smart: {
      speed: 600,
      color: '#e91e63',
      points: 100,
      spawnChance: 0.6
    }
  },
  levelConfig: {
    1: [{ type: 'normal', count: 3 }],
    2: [{ type: 'normal', count: 3 }, { type: 'fast', count: 1 }],
    3: [{ type: 'normal', count: 2 }, { type: 'bomber', count: 1 }, { type: 'fast', count: 1 }],
    4: [{ type: 'bomber', count: 2 }, { type: 'smart', count: 2 }],
    default: [{ type: 'smart', count: 3 }, { type: 'bomber', count: 2 }, { type: 'fast', count: 2 }]
  },
  eyeBlink: true,
  shadowEffect: true
};

const LEVEL_CONFIG = {
  wallDensity: {
    1: 0.40,
    2: 0.45,
    3: 0.50,
    4: 0.55,
    default: 0.65
  },
  exitConditions: {
    earlyExit: [1, 2, 3, 4],
    killAllRequired: 5
  },
  powerupDropChance: 0.15,
  detonatorChance: 0.2,
  powerups: {
    bomb: {
      color: '#ff6b6b',
      effect: 'Увеличивает количество бомб на 1',
      points: 25
    },
    range: {
      color: '#4ecdc4',
      effect: 'Увеличивает радиус взрыва на 1',
      points: 25
    },
    speed: {
      color: '#ffe66d',
      effect: 'Увеличивает скорость движения',
      points: 25
    },
    det: {
      color: '#ff66ff',
      effect: 'Детонатор - взрывай бомбы по нажатию E',
      points: 50
    }
  },
  levelClearBonus: 100
};

// ========================================
// НАСТРОЙКИ СТЕН И ГРАНИЦ
// ========================================
const WALL_CONFIG = {
  // Слои стен по уровням
  borderLayers: {
    1: 3,
    2: 2,
    3: 1,
    4: 0,
    default: 0
  },
  
  // Паттерны неразрушаемых блоков
  patterns: {
    1: 'classic',
    2: 'diagonal',
    3: 'sparse',
    4: 'checkerboard',
    5: 'random'
  },
  
  // Телепортация
  teleportEnabled: true,
  teleportEffect: true
};

const COMBO_CONFIG = {
  enabled: true,
  timeWindow: 3000,
  bonusPerCombo: 10,
  showComboText: true
};

const SCORING_CONFIG = {
  destroyWall: 10,
  killEnemy: 50,
  collectPowerup: 25,
  timePenalty: true,
  timePenaltyRate: 1,
  showTimePenaltyInPause: false
};

const VISUAL_CONFIG = {
  particles: {
    enabled: true,
    fadeSpeed: 0.96,
    maxLifetime: 50
  },
  powerupAnimation: {
    rotation: true,
    pulse: true,
    glow: true
  },
  gridLines: {
    enabled: true,
    opacity: 0.03
  },
  shadows: true,
  gradients: true,
  smoothMovement: true,
  smoothFactor: 8,
  exitGate: {
    enabled: true,
    pulseSpeed: 500,
    openAnimation: true
  }
};

const DEBUG_CONFIG = {
  showFPS: false,
  showCollisions: false,
  godMode: false,
  infiniteBombs: false,
  skipToLevel: null
};
