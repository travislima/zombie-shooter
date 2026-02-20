import * as THREE from 'three';

// Enemy states
const STATE = {
  SPAWNING: 0,
  APPROACHING: 1,
  ATTACKING: 2,  // melee attack (lunge)
  DYING: 4,
};

// Enemy type configs - zombies (melee only)
export const ENEMY_TYPES = {
  walker: {
    health: 20,
    speed: 3,
    damage: 10,
    points: 100,
    color: 0x5a7a3a,      // sickly green
    emissive: 0x2a4a1a,   // dark green glow
    size: 0.5,
    meleeRange: 1.5,      // distance to deal damage
    attackCooldown: 1.0,   // seconds between melee hits
  },
  runner: {
    health: 40,
    speed: 5.5,
    damage: 15,
    points: 250,
    color: 0x7a4a3a,      // rotting brown
    emissive: 0x4a2a1a,   // dark brown glow
    size: 0.55,
    meleeRange: 1.5,
    attackCooldown: 0.6,
  },
  tank: {
    health: 150,
    speed: 1.8,
    damage: 30,
    points: 500,
    color: 0x5a3a5a,      // bruised purple
    emissive: 0x3a1a3a,   // dark purple glow
    size: 0.8,
    meleeRange: 2.0,
    attackCooldown: 1.5,
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

  update(dt, playerPos) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const enemy = this.active[i];
      enemy.update(dt, playerPos);

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
    this.flashTimer = 0;
    this.deathTimer = 0;
    this.spawnTimer = 0;
    this.meleeCooldown = 0;
    this.animPhase = Math.random() * Math.PI * 2;

    // Main mesh group
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    // --- Build zombie body with limbs ---

    // Torso
    this.torsoGeo = new THREE.BoxGeometry(0.4, 0.5, 0.25);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5a7a3a,
      emissive: 0x2a4a1a,
      emissiveIntensity: 0.2,
      metalness: 0.1,
      roughness: 0.8,
    });
    this.torso = new THREE.Mesh(this.torsoGeo, this.bodyMat);
    this.torso.position.y = 0;
    this.group.add(this.torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.headMat = new THREE.MeshStandardMaterial({
      color: 0x6a8a4a,
      roughness: 0.7,
      metalness: 0.1,
    });
    this.head = new THREE.Mesh(headGeo, this.headMat);
    this.head.position.y = 0.4;
    this.group.add(this.head);

    // Eyes - glowing yellow
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xccaa00 });
    this.eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeLeft.position.set(-0.07, 0.43, 0.14);
    this.group.add(this.eyeLeft);
    this.eyeRight = new THREE.Mesh(eyeGeo.clone(), eyeMat.clone());
    this.eyeRight.position.set(0.07, 0.43, 0.14);
    this.group.add(this.eyeRight);

    // Jaw (open mouth effect)
    const jawGeo = new THREE.BoxGeometry(0.1, 0.04, 0.08);
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x3a1a1a, roughness: 0.9 });
    this.jaw = new THREE.Mesh(jawGeo, jawMat);
    this.jaw.position.set(0, 0.32, 0.12);
    this.group.add(this.jaw);

    // --- Arms ---
    const armGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    this.armMatL = new THREE.MeshStandardMaterial({
      color: 0x5a7a3a, emissive: 0x2a4a1a, emissiveIntensity: 0.15,
      metalness: 0.1, roughness: 0.8,
    });
    this.armMatR = this.armMatL.clone();

    // Left arm pivot
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.28, 0.15, 0);
    this.leftArm = new THREE.Mesh(armGeo, this.armMatL);
    this.leftArm.position.y = -0.2;
    this.leftArmPivot.add(this.leftArm);
    this.group.add(this.leftArmPivot);

    // Right arm pivot
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.28, 0.15, 0);
    this.rightArm = new THREE.Mesh(armGeo, this.armMatR);
    this.rightArm.position.y = -0.2;
    this.rightArmPivot.add(this.rightArm);
    this.group.add(this.rightArmPivot);

    // --- Legs ---
    const legGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
    this.legMatL = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a, roughness: 0.9, metalness: 0.05,
    });
    this.legMatR = this.legMatL.clone();

    // Left leg pivot
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, -0.25, 0);
    this.leftLeg = new THREE.Mesh(legGeo, this.legMatL);
    this.leftLeg.position.y = -0.2;
    this.leftLegPivot.add(this.leftLeg);
    this.group.add(this.leftLegPivot);

    // Right leg pivot
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, -0.25, 0);
    this.rightLeg = new THREE.Mesh(legGeo, this.legMatR);
    this.rightLeg.position.y = -0.2;
    this.rightLegPivot.add(this.rightLeg);
    this.group.add(this.rightLegPivot);

    // Glow - eerie
    this.light = new THREE.PointLight(0x5a7a3a, 0.15, 3);
    this.group.add(this.light);

    // Health bar
    const hbGeo = new THREE.PlaneGeometry(0.8, 0.06);
    const hbBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this.healthBarBg = new THREE.Mesh(hbGeo, hbBgMat);
    this.healthBarBg.position.y = 0.75;
    this.group.add(this.healthBarBg);

    const hbFillGeo = new THREE.PlaneGeometry(0.8, 0.06);
    const hbFillMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
    this.healthBarFill = new THREE.Mesh(hbFillGeo, hbFillMat);
    this.healthBarFill.position.y = 0.75;
    this.healthBarFill.position.z = 0.001;
    this.group.add(this.healthBarFill);

    this._origColor = new THREE.Color();
    this._origEmissive = new THREE.Color();
    this._toPlayer = new THREE.Vector3();
  }

  activate(type, config, position) {
    this.active = true;
    this.type = type;
    this.config = config;
    this.position.copy(position);
    this.position.y = 1.0;
    this.velocity.set(0, 0, 0);
    this.health = config.health;
    this.maxHealth = config.health;
    this.state = STATE.SPAWNING;
    this.spawnTimer = 0.5;
    this.flashTimer = 0;
    this.deathTimer = 0;
    this.meleeCooldown = 0;
    this.animPhase = Math.random() * Math.PI * 2;

    // Configure appearance based on type
    this.bodyMat.color.set(config.color);
    this.bodyMat.emissive.set(config.emissive);
    this._origColor.set(config.color);
    this._origEmissive.set(config.emissive);
    this.light.color.set(config.color);

    // Arm and leg colors
    this.armMatL.color.set(config.color);
    this.armMatL.emissive.set(config.emissive);
    this.armMatR.color.set(config.color);
    this.armMatR.emissive.set(config.emissive);

    const legColor = type === 'runner' ? 0x5a3a2a : 0x4a3a2a;
    this.legMatL.color.set(legColor);
    this.legMatR.color.set(legColor);

    // Head color
    const headColor = type === 'runner' ? 0x8a5a4a : 0x6a8a4a;
    this.headMat.color.set(headColor);

    const s = config.size;
    this.group.scale.setScalar(s * 2); // scale up since model is smaller now

    this.group.position.copy(this.position);
    this.group.visible = true;
    this.group.scale.setScalar(0.01);
  }

  update(dt, playerPos) {
    if (!this.active) return;

    switch (this.state) {
      case STATE.SPAWNING:
        this._updateSpawning(dt);
        break;
      case STATE.APPROACHING:
        this._updateApproaching(dt, playerPos);
        break;
      case STATE.ATTACKING:
        this._updateAttacking(dt, playerPos);
        break;
      case STATE.DYING:
        this._updateDying(dt);
        break;
    }

    // Melee cooldown
    if (this.meleeCooldown > 0) this.meleeCooldown -= dt;

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

    // Walking animation (limbs swing)
    if (this.state === STATE.APPROACHING || this.state === STATE.ATTACKING) {
      this.animPhase += dt * (this.config.speed * 2.5);
      const swing = Math.sin(this.animPhase);

      // Arms swing forward (zombies reaching out)
      this.leftArmPivot.rotation.x = -0.8 + swing * 0.3;   // arms extended forward
      this.rightArmPivot.rotation.x = -0.8 - swing * 0.3;

      // Legs walk
      this.leftLegPivot.rotation.x = swing * 0.5;
      this.rightLegPivot.rotation.x = -swing * 0.5;

      // Subtle body bob
      this.torso.position.y = Math.abs(swing) * 0.04;

      // Head tilt (shambling)
      this.head.rotation.z = Math.sin(this.animPhase * 0.7) * 0.1;
      this.head.rotation.x = -0.1; // slightly looking forward/down
    }

    // Face player
    if (playerPos && this.state !== STATE.DYING) {
      this._toPlayer.subVectors(playerPos, this.position);
      this._toPlayer.y = 0;
      if (this._toPlayer.lengthSq() > 0.01) {
        const angle = Math.atan2(this._toPlayer.x, this._toPlayer.z);
        // Smooth rotation
        let diff = angle - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1, dt * 5);
      }
    }

    // Update group position
    this.group.position.copy(this.position);

    // Face health bars at player
    if (playerPos) {
      this.healthBarBg.lookAt(playerPos);
      this.healthBarFill.lookAt(playerPos);
    }

    // Update health bar
    const hpRatio = this.health / this.maxHealth;
    this.healthBarFill.scale.x = Math.max(0.001, hpRatio);
    this.healthBarFill.position.x = (hpRatio - 1) * 0.4;
  }

  _updateSpawning(dt) {
    this.spawnTimer -= dt;
    const s = this.config.size;
    const t = 1 - Math.max(0, this.spawnTimer / 0.5);
    this.group.scale.setScalar(t * s * 2);
    if (this.spawnTimer <= 0) {
      this.group.scale.setScalar(s * 2);
      this.state = STATE.APPROACHING;
    }
  }

  _updateApproaching(dt, playerPos) {
    if (!playerPos) return;
    this._toPlayer.subVectors(playerPos, this.position);
    this._toPlayer.y = 0;
    const dist = this._toPlayer.length();

    if (dist > this.config.meleeRange) {
      this._toPlayer.normalize();
      this.position.addScaledVector(this._toPlayer, this.config.speed * dt);
    } else {
      this.state = STATE.ATTACKING;
    }

    // Keep in arena
    this._clampToArena();
  }

  _updateAttacking(dt, playerPos) {
    if (!playerPos) return;
    this._toPlayer.subVectors(playerPos, this.position);
    this._toPlayer.y = 0;
    const dist = this._toPlayer.length();

    // Keep chasing if player moved away
    if (dist > this.config.meleeRange * 1.5) {
      this.state = STATE.APPROACHING;
      return;
    }

    // Move toward player (slowly close remaining gap)
    if (dist > 0.8) {
      this._toPlayer.normalize();
      this.position.addScaledVector(this._toPlayer, this.config.speed * 0.5 * dt);
    }

    this._clampToArena();
  }

  // Check if this enemy can deal melee damage to the player
  canMelee(playerPos) {
    if (this.state === STATE.DYING || this.state === STATE.SPAWNING) return false;
    if (this.meleeCooldown > 0) return false;

    const dist = this.position.distanceTo(playerPos);
    return dist < this.config.meleeRange;
  }

  // Called when melee hit lands
  onMeleeHit() {
    this.meleeCooldown = this.config.attackCooldown;
    // Lunge animation - brief arm thrust
    this.leftArmPivot.rotation.x = -1.4;
    this.rightArmPivot.rotation.x = -1.4;
  }

  _clampToArena() {
    const posDist = Math.sqrt(this.position.x ** 2 + this.position.z ** 2);
    if (posDist > 18) {
      const scale = 18 / posDist;
      this.position.x *= scale;
      this.position.z *= scale;
    }
  }

  _updateDying(dt) {
    this.deathTimer += dt;
    const t = this.deathTimer / 0.5;

    // Collapse animation
    this.group.scale.y = Math.max(0.01, 1 - t) * this.config.size * 2;
    this.group.position.y = this.position.y * (1 - t * 0.8);
    this.torso.rotation.x = t * 1.2; // fall forward
    this.bodyMat.emissive.set(0xaa3300);
    this.bodyMat.emissiveIntensity = 2 * (1 - t);

    // Arms go limp
    this.leftArmPivot.rotation.x = -0.3 - t * 1.5;
    this.rightArmPivot.rotation.x = -0.3 - t * 1.5;
    this.leftArmPivot.rotation.z = -t * 0.8;
    this.rightArmPivot.rotation.z = t * 0.8;

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
    this.group.scale.y = 1;
    this.group.rotation.y = 0;
    this.torso.rotation.x = 0;
    this.leftArmPivot.rotation.set(0, 0, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);
    this.bodyMat.emissive.copy(this._origEmissive);
    this.bodyMat.emissiveIntensity = 0.2;
  }

  // Bounding sphere radius for collision
  get radius() {
    return (this.config?.size || 0.5) * 0.8;
  }
}
