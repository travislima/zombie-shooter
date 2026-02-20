import * as THREE from 'three';

const SPAWN_RADIUS = 20;

export class WaveManager {
  constructor(enemyManager) {
    this.enemyManager = enemyManager;
    this.wave = 0;
    this.state = 'idle'; // idle, announcing, spawning, active, complete
    this.stateTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnDelay = 0.5;
    this.totalEnemiesThisWave = 0;
    this.enemiesKilledThisWave = 0;
  }

  reset() {
    this.wave = 0;
    this.state = 'idle';
    this.stateTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.totalEnemiesThisWave = 0;
    this.enemiesKilledThisWave = 0;
  }

  startNextWave() {
    this.wave++;
    this.state = 'announcing';
    this.stateTimer = 2.5; // announcement duration
    this.enemiesKilledThisWave = 0;

    // Build spawn queue based on wave number
    this.spawnQueue = this._buildWaveComposition(this.wave);
    this.totalEnemiesThisWave = this.spawnQueue.length;
    this.spawnTimer = 0;

    return this.wave;
  }

  _buildWaveComposition(wave) {
    const queue = [];

    // Base walker count increases with wave
    const walkerCount = Math.min(3 + wave * 2, 20);

    // Runners appear from wave 3
    const runnerCount = wave >= 3 ? Math.min(Math.floor((wave - 2) * 1.5), 10) : 0;

    // Tanks appear from wave 5
    const tankCount = wave >= 5 ? Math.min(Math.floor((wave - 4) * 0.8), 5) : 0;

    for (let i = 0; i < walkerCount; i++) queue.push('walker');
    for (let i = 0; i < runnerCount; i++) queue.push('runner');
    for (let i = 0; i < tankCount; i++) queue.push('tank');

    // Shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue;
  }

  update(dt) {
    switch (this.state) {
      case 'announcing':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'spawning';
        }
        break;

      case 'spawning':
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
          const type = this.spawnQueue.shift();
          this._spawnEnemy(type);
          // Faster spawning in later waves
          this.spawnDelay = Math.max(0.15, 0.5 - this.wave * 0.03);
          this.spawnTimer = this.spawnDelay;
        }
        if (this.spawnQueue.length === 0) {
          this.state = 'active';
        }
        break;

      case 'active':
        // Check if all enemies are dead
        if (this.enemyManager.count === 0) {
          this.state = 'complete';
          this.stateTimer = 2; // pause before next wave
        }
        break;

      case 'complete':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
        }
        break;
    }
  }

  _spawnEnemy(type) {
    // Random position on arena perimeter
    const angle = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(
      Math.cos(angle) * SPAWN_RADIUS,
      1.2,
      Math.sin(angle) * SPAWN_RADIUS,
    );
    this.enemyManager.spawn(type, pos);
  }

  onEnemyKilled() {
    this.enemiesKilledThisWave++;
  }

  get isWaveActive() {
    return this.state === 'spawning' || this.state === 'active';
  }

  get isAnnouncing() {
    return this.state === 'announcing';
  }

  get isComplete() {
    return this.state === 'complete';
  }

  get isIdle() {
    return this.state === 'idle';
  }

  getWaveSubtext() {
    if (this.wave <= 2) return 'Walkers approaching';
    if (this.wave <= 4) return 'Runners spotted';
    if (this.wave === 5) return 'TANK INCOMING';
    if (this.wave <= 10) return 'The horde grows';
    return 'Total outbreak';
  }
}
