import * as THREE from 'three';

const PLAYER_RADIUS = 0.5;
const COMBO_TIMEOUT = 2; // seconds

export class Combat {
  constructor() {
    this.score = 0;
    this.combo = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.totalKills = 0;
    this.highestCombo = 0;

    this._raycaster = new THREE.Raycaster();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.totalKills = 0;
    this.highestCombo = 0;
  }

  update(dt) {
    // Combo decay
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboMultiplier = 1.0;
      }
    }
  }

  // Check player projectiles against enemies
  checkPlayerProjectiles(projectiles, enemies, weapon, audio, particles, camera) {
    const hits = [];

    for (const proj of projectiles) {
      if (!proj.active || !proj.isPlayer) continue;

      for (const enemy of enemies) {
        if (!enemy.active || enemy.state === 4) continue; // STATE.DYING = 4

        const dist = proj.position.distanceTo(enemy.position);
        if (dist < enemy.radius + 0.15) {
          // Hit!
          const killed = enemy.takeDamage(proj.damage);
          proj.deactivate();
          weapon.registerHit();

          if (audio) audio.playHit();
          if (particles) particles.spawnHitEffect(proj.position, enemy.config.color);

          if (killed) {
            const points = this._scoreKill(enemy);
            if (audio) audio.playKill();
            if (particles) particles.spawnExplosion(enemy.position, enemy.config.color);
            hits.push({ enemy, points, killed: true, position: enemy.position.clone() });
          } else {
            hits.push({ enemy, points: 0, killed: false, position: enemy.position.clone() });
          }
          break; // projectile can only hit one enemy
        }
      }
    }

    return hits;
  }

  // Check enemy melee attacks against player
  checkEnemyMelee(enemies, player, audio) {
    if (!player.alive) return false;

    let hit = false;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (enemy.canMelee(player.position)) {
        player.takeDamage(enemy.config.damage);
        enemy.onMeleeHit();
        hit = true;
      }
    }
    return hit;
  }

  // Hitscan check from camera center (for instant-feel shooting alongside projectile)
  raycastFromCamera(camera, enemies) {
    this._raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    return null;
  }

  _scoreKill(enemy) {
    this.combo++;
    this.comboTimer = COMBO_TIMEOUT;
    this.comboMultiplier = 1.0 + (this.combo - 1) * 0.1;
    this.comboMultiplier = Math.min(3.0, this.comboMultiplier);

    if (this.combo > this.highestCombo) {
      this.highestCombo = this.combo;
    }

    const basePoints = enemy.config?.points || 100;
    const points = Math.round(basePoints * this.comboMultiplier);
    this.score += points;
    this.totalKills++;

    return points;
  }

  // Called when player misses (projectile hits nothing)
  onMiss() {
    // Combo resets on miss are handled by timeout instead
  }
}
