import * as THREE from 'three';

// Enemy states
const STATE = {
  SPAWNING: 0,
  APPROACHING: 1,
  ATTACKING: 2,
  STRAFING: 3,
  DYING: 4,
};

// Enemy type configs - zombies
export const ENEMY_TYPES = {
  walker: {
    health: 20,
    speed: 3,
    damage: 5,
    points: 100,
    fireRate: 0.8,    // shots per second
    projectileSpeed: 15,
    color: 0x5a7a3a,      // sickly green
    emissive: 0x2a4a1a,   // dark green glow
    size: 0.5,
    attackRange: 20,
    preferredRange: 12,
  },
  runner: {
    health: 40,
    speed: 4,
    damage: 8,
    points: 250,
    fireRate: 1.2,
    projectileSpeed: 18,
    color: 0x7a4a3a,      // rotting brown
    emissive: 0x4a2a1a,   // dark brown glow
    size: 0.6,
    attackRange: 22,
    preferredRange: 10,
    burstCount: 3,
    burstDelay: 0.15,
  },
};

const POOL_SIZE = 40;

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.active = [];

    // Pre-create enemy pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const enemy = new EnemyInstance(scene);
      this.enemies.push(enemy);
    }
  }

  spawn(type, position) {
    const config = ENEMY_TYPES[type];
    if (!config) return null;

    const enemy = this.enemies.find(e => !e.active);
    if (!enemy) return null;

    enemy.activate(type, config, position);
    this.active.push(enemy);
    return enemy;
  }

  update(dt, playerPos, projectilePool, audio) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const enemy = this.active[i];
      enemy.update(dt, playerPos, projectilePool, audio);

      if (!enemy.active) {
        this.active.splice(i, 1);
      }
    }
  }

  getActive() {
    return this.active;
  }

  get count() {
    return this.active.length;
  }

  reset() {
    for (const enemy of this.active) {
      enemy.deactivate();
    }
    this.active.length = 0;
  }
}

class EnemyInstance {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.type = 'walker';
    this.config = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.health = 0;
    this.maxHealth = 0;
    this.state = STATE.SPAWNING;
    this.stateTimer = 0;
    this.fireTimer = 0;
    this.burstRemaining = 0;
    this.burstTimer = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.flashTimer = 0;
    this.deathTimer = 0;
    this.spawnTimer = 0;

    // Main mesh group
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    // Body mesh - zombie torso
    this.bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.3);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5a7a3a,
      emissive: 0x2a4a1a,
      emissiveIntensity: 0.2,
      metalness: 0.1,
      roughness: 0.8,
    });
    this.body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    this.group.add(this.body);

    // Zombie head
    const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
    this.headMat = new THREE.MeshStandardMaterial({
      color: 0x6a8a4a,
      roughness: 0.7,
      metalness: 0.1,
    });
    this.head = new THREE.Mesh(headGeo, this.headMat);
    this.head.position.y = 0.45;
    this.group.add(this.head);

    // Glow - eerie
    this.light = new THREE.PointLight(0x5a7a3a, 0.2, 4);
    this.group.add(this.light);

    // Health bar
    const hbGeo = new THREE.PlaneGeometry(0.8, 0.06);
    const hbBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this.healthBarBg = new THREE.Mesh(hbGeo, hbBgMat);
    this.healthBarBg.position.y = 0.8;
    this.group.add(this.healthBarBg);

    const hbFillGeo = new THREE.PlaneGeometry(0.8, 0.06);
    const hbFillMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
    this.healthBarFill = new THREE.Mesh(hbFillGeo, hbFillMat);
    this.healthBarFill.position.y = 0.8;
    this.healthBarFill.position.z = 0.001;
    this.group.add(this.healthBarFill);

    // Eyes - glowing yellow zombie eyes
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xccaa00 });
    this.eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeLeft.position.set(-0.08, 0.48, 0.15);
    this.group.add(this.eyeLeft);

    this.eyeRight = new THREE.Mesh(eyeGeo.clone(), eyeMat.clone());
    this.eyeRight.position.set(0.08, 0.48, 0.15);
    this.group.add(this.eyeRight);

    this._origColor = new THREE.Color();
    this._origEmissive = new THREE.Color();
  }

  activate(type, config, position) {
    this.active = true;
    this.type = type;
    this.config = config;
    this.position.copy(position);
    this.position.y = 1.2;
    this.velocity.set(0, 0, 0);
    this.health = config.health;
    this.maxHealth = config.health;
    this.state = STATE.SPAWNING;
    this.spawnTimer = 0.5;
    this.fireTimer = 1 + Math.random(); // initial delay
    this.burstRemaining = 0;
    this.burstTimer = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 2 + Math.random() * 2;
    this.flashTimer = 0;
    this.deathTimer = 0;

    // Configure appearance based on type
    this.bodyMat.color.set(config.color);
    this.bodyMat.emissive.set(config.emissive);
    this._origColor.set(config.color);
    this._origEmissive.set(config.emissive);
    this.light.color.set(config.color);

    // Update head color to match type
    const headColor = type === 'runner' ? 0x8a5a4a : 0x6a8a4a;
    this.headMat.color.set(headColor);

    const s = config.size;
    this.body.scale.setScalar(s);
    this.head.scale.setScalar(s);

    // Different body shape per type
    this.group.remove(this.body);
    if (type === 'runner') {
      // Runner - leaner, more aggressive shape
      this.bodyGeo = new THREE.BoxGeometry(0.35, 0.7, 0.25);
    } else {
      // Walker - stockier, shambling shape
      this.bodyGeo = new THREE.BoxGeometry(0.45, 0.55, 0.35);
    }
    this.body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    this.body.scale.setScalar(s);
    this.group.add(this.body);

    this.group.position.copy(this.position);
    this.group.visible = true;
    this.group.scale.setScalar(0.01);
  }

  update(dt, playerPos, projectilePool, audio) {
    if (!this.active) return;

    switch (this.state) {
      case STATE.SPAWNING:
        this._updateSpawning(dt);
        break;
      case STATE.APPROACHING:
        this._updateApproaching(dt, playerPos);
        break;
      case STATE.ATTACKING:
        this._updateAttacking(dt, playerPos, projectilePool, audio);
        break;
      case STATE.STRAFING:
        this._updateStrafing(dt, playerPos, projectilePool, audio);
        break;
      case STATE.DYING:
        this._updateDying(dt);
        break;
    }

    // Damage flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer > 0) {
        this.bodyMat.emissive.set(0xffffff);
        this.bodyMat.emissiveIntensity = 2;
      } else {
        this.bodyMat.emissive.copy(this._origEmissive);
        this.bodyMat.emissiveIntensity = 0.2;
      }
    }

    // Shambling bob animation
    if (this.state !== STATE.DYING) {
      this.position.y = 1.2 + Math.sin(Date.now() * 0.003 + this.position.x * 10) * 0.08;
      // Slight tilt for shambling effect
      this.body.rotation.z = Math.sin(Date.now() * 0.004 + this.position.z * 5) * 0.15;
    }

    // Update group position
    this.group.position.copy(this.position);

    // Face player (health bars)
    if (playerPos) {
      this.healthBarBg.lookAt(playerPos);
      this.healthBarFill.lookAt(playerPos);
    }

    // Update health bar
    const hpRatio = this.health / this.maxHealth;
    this.healthBarFill.scale.x = Math.max(0.001, hpRatio);
    this.healthBarFill.position.x = (hpRatio - 1) * 0.4;

    // Body rotation - slow shambling turn instead of spinning
    if (this.state !== STATE.DYING) {
      this.body.rotation.y += dt * 0.3;
    }
  }

  _updateSpawning(dt) {
    this.spawnTimer -= dt;
    const t = 1 - Math.max(0, this.spawnTimer / 0.5);
    this.group.scale.setScalar(t);
    if (this.spawnTimer <= 0) {
      this.group.scale.setScalar(1);
      this.state = STATE.APPROACHING;
    }
  }

  _updateApproaching(dt, playerPos) {
    if (!playerPos) return;
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist > this.config.preferredRange) {
      toPlayer.normalize();
      this.position.addScaledVector(toPlayer, this.config.speed * dt);
    } else {
      // Switch to attack/strafe
      this.state = this.type === 'runner' ? STATE.STRAFING : STATE.ATTACKING;
    }
  }

  _updateAttacking(dt, playerPos, projectilePool, audio) {
    if (!playerPos) return;

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Maintain distance
    if (dist < this.config.preferredRange * 0.7) {
      toPlayer.normalize();
      this.position.addScaledVector(toPlayer, -this.config.speed * 0.5 * dt);
    }

    // Fire
    this._handleFiring(dt, playerPos, projectilePool, audio);
  }

  _updateStrafing(dt, playerPos, projectilePool, audio) {
    if (!playerPos) return;

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Strafe perpendicular to player
    const strafeVec = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
    this.position.addScaledVector(strafeVec, this.strafeDir * this.config.speed * 0.7 * dt);

    // Maintain distance
    if (dist < this.config.preferredRange * 0.6) {
      toPlayer.normalize();
      this.position.addScaledVector(toPlayer, -this.config.speed * 0.3 * dt);
    } else if (dist > this.config.preferredRange * 1.3) {
      toPlayer.normalize();
      this.position.addScaledVector(toPlayer, this.config.speed * 0.3 * dt);
    }

    // Change strafe direction
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = 1.5 + Math.random() * 2;
    }

    // Keep in arena
    const posDist = Math.sqrt(this.position.x ** 2 + this.position.z ** 2);
    if (posDist > 18) {
      const scale = 18 / posDist;
      this.position.x *= scale;
      this.position.z *= scale;
    }

    this._handleFiring(dt, playerPos, projectilePool, audio);
  }

  _handleFiring(dt, playerPos, projectilePool, audio) {
    // Burst fire for runners
    if (this.burstRemaining > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this._fireProjectile(playerPos, projectilePool, audio);
        this.burstRemaining--;
        this.burstTimer = this.config.burstDelay || 0.15;
      }
      return;
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      if (this.config.burstCount) {
        this.burstRemaining = this.config.burstCount;
        this.burstTimer = 0;
      } else {
        this._fireProjectile(playerPos, projectilePool, audio);
      }
      this.fireTimer = 1 / this.config.fireRate + Math.random() * 0.3;
    }
  }

  _fireProjectile(playerPos, projectilePool, audio) {
    const dir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
    // Add some inaccuracy
    dir.x += (Math.random() - 0.5) * 0.15;
    dir.y += (Math.random() - 0.5) * 0.1;
    dir.z += (Math.random() - 0.5) * 0.15;
    dir.normalize();

    projectilePool.spawn(
      this.position.clone(),
      dir,
      this.config.projectileSpeed,
      this.config.damage,
      false,
    );

    if (audio) audio.playEnemyShoot();
  }

  _updateDying(dt) {
    this.deathTimer += dt;
    const t = this.deathTimer / 0.4;

    this.group.scale.setScalar(Math.max(0.01, 1 - t));
    this.body.rotation.x += dt * 5;
    this.bodyMat.emissive.set(0xaa3300);
    this.bodyMat.emissiveIntensity = 2 * (1 - t);

    if (t >= 1) {
      this.deactivate();
    }
  }

  takeDamage(amount) {
    if (this.state === STATE.DYING) return false;

    this.health -= amount;
    this.flashTimer = 0.1;

    if (this.health <= 0) {
      this.health = 0;
      this.state = STATE.DYING;
      this.deathTimer = 0;
      return true; // killed
    }
    return false;
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
    this.group.scale.setScalar(1);
    this.bodyMat.emissive.copy(this._origEmissive);
    this.bodyMat.emissiveIntensity = 0.2;
  }

  // Bounding sphere radius for collision
  get radius() {
    return (this.config?.size || 0.5) * 0.8;
  }
}
