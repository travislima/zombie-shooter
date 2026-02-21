import * as THREE from 'three';
import { ZombieTextures } from './ZombieTextures.js';

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
    eyeColor: 0xaacc00,   // sickly yellow-green
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
    eyeColor: 0xff4400,   // angry red
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
    eyeColor: 0x99bbff,   // pale dead white-blue
  },
};

const POOL_SIZE = 40;

// --- Shared geometries (created once, reused by all instances) ---
const GEO = {};
let geoReady = false;

function lcg(seed) {
  let s = (Math.abs(seed) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function createShirtGeo(seed) {
  const g = new THREE.BoxGeometry(0.46, 0.36, 0.3, 6, 4, 1);
  const pos = g.getAttribute('position');
  const r = lcg(seed);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Ragged bottom edge
    if (y < -0.13) {
      pos.setY(i, y + r() * 0.14);
    }
    // Slight waviness for worn look
    pos.setX(i, pos.getX(i) + (r() - 0.5) * 0.015);
    pos.setZ(i, pos.getZ(i) + (r() - 0.5) * 0.015);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function initGeo() {
  if (geoReady) return;
  GEO.torso = new THREE.BoxGeometry(0.4, 0.5, 0.25);
  GEO.head = new THREE.SphereGeometry(0.18, 12, 10);
  GEO.eye = new THREE.SphereGeometry(0.04, 6, 6);
  GEO.jaw = new THREE.BoxGeometry(0.12, 0.05, 0.08);
  GEO.arm = new THREE.CapsuleGeometry(0.045, 0.28, 4, 8);
  GEO.leg = new THREE.CapsuleGeometry(0.055, 0.26, 4, 8);
  GEO.tooth = new THREE.BoxGeometry(0.018, 0.028, 0.012);
  GEO.growth = new THREE.SphereGeometry(0.08, 6, 6);
  GEO.rib = new THREE.BoxGeometry(0.03, 0.012, 0.1);
  GEO.shirt = [createShirtGeo(42), createShirtGeo(137)];
  GEO.hpBar = new THREE.PlaneGeometry(0.8, 0.06);
  geoReady = true;
}

export class EnemyManager {
  constructor(scene) {
    initGeo();
    this.scene = scene;
    this.enemies = [];
    this.active = [];

    // Pre-create enemy pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const enemy = new EnemyInstance(scene, i);
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
  constructor(scene, index) {
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
    this.variant = index % 2;

    // Main mesh group
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    // Default textures (swapped per-type in activate)
    const defaultSkin = ZombieTextures.getSkin('walker', 0);
    const defaultBump = ZombieTextures.getBump('walker', 0);

    // --- Torso ---
    this.bodyMat = new THREE.MeshStandardMaterial({
      map: defaultSkin,
      bumpMap: defaultBump,
      bumpScale: 0.15,
      color: 0xffffff,
      emissive: 0x2a4a1a,
      emissiveIntensity: 0.15,
      metalness: 0.05,
      roughness: 0.85,
    });
    this.torso = new THREE.Mesh(GEO.torso, this.bodyMat);
    this.torso.position.y = 0;
    this.group.add(this.torso);

    // --- Torn Shirt ---
    this.clothMat = new THREE.MeshStandardMaterial({
      map: ZombieTextures.getShirt(this.variant),
      roughness: 0.95,
      metalness: 0.0,
    });
    this.clothing = new THREE.Mesh(GEO.shirt[this.variant], this.clothMat);
    this.clothing.position.y = 0.05;
    this.group.add(this.clothing);

    // --- Head ---
    this.headMat = new THREE.MeshStandardMaterial({
      map: defaultSkin,
      bumpMap: defaultBump,
      bumpScale: 0.12,
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.05,
    });
    this.head = new THREE.Mesh(GEO.head, this.headMat);
    this.head.position.y = 0.4;
    this.group.add(this.head);

    // --- Eyes (per-instance materials for type-specific color) ---
    this.eyeMatL = new THREE.MeshBasicMaterial({ color: 0xaacc00 });
    this.eyeMatR = new THREE.MeshBasicMaterial({ color: 0xaacc00 });
    this.eyeLeft = new THREE.Mesh(GEO.eye, this.eyeMatL);
    this.eyeLeft.position.set(-0.07, 0.43, 0.14);
    this.group.add(this.eyeLeft);
    this.eyeRight = new THREE.Mesh(GEO.eye, this.eyeMatR);
    this.eyeRight.position.set(0.07, 0.43, 0.14);
    this.group.add(this.eyeRight);

    // --- Jaw ---
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x3a1a1a, roughness: 0.9 });
    this.jaw = new THREE.Mesh(GEO.jaw, jawMat);
    this.jaw.position.set(0, 0.32, 0.12);
    this.group.add(this.jaw);

    // --- Teeth (irregular, exposed) ---
    const toothMat = new THREE.MeshStandardMaterial({
      color: 0xddcc88,
      roughness: 0.6,
      metalness: 0.1,
    });
    this.teeth = [];
    const toothData = [
      // [x, y, z, rotZ] — upper and lower teeth
      [-0.03, 0.35, 0.15, 0.1],
      [0.0, 0.345, 0.16, -0.05],
      [0.035, 0.35, 0.15, 0.15],
      [-0.02, 0.305, 0.15, -0.1],  // lower
      [0.025, 0.31, 0.15, -0.15],  // lower
    ];
    for (const [tx, ty, tz, rot] of toothData) {
      const tooth = new THREE.Mesh(GEO.tooth, toothMat);
      tooth.position.set(tx, ty, tz);
      tooth.rotation.z = rot;
      this.group.add(tooth);
      this.teeth.push(tooth);
    }

    // --- Arms (CapsuleGeometry for organic rounded limbs) ---
    this.armMatL = new THREE.MeshStandardMaterial({
      map: defaultSkin,
      bumpMap: defaultBump,
      bumpScale: 0.12,
      color: 0xffffff,
      emissive: 0x2a4a1a,
      emissiveIntensity: 0.1,
      metalness: 0.05,
      roughness: 0.85,
    });
    this.armMatR = this.armMatL.clone();

    // Left arm pivot
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.28, 0.15, 0);
    this.leftArm = new THREE.Mesh(GEO.arm, this.armMatL);
    this.leftArm.position.y = -0.2;
    this.leftArmPivot.add(this.leftArm);
    this.group.add(this.leftArmPivot);

    // Right arm pivot
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.28, 0.15, 0);
    this.rightArm = new THREE.Mesh(GEO.arm, this.armMatR);
    this.rightArm.position.y = -0.2;
    this.rightArmPivot.add(this.rightArm);
    this.group.add(this.rightArmPivot);

    // --- Legs (CapsuleGeometry) ---
    this.legMatL = new THREE.MeshStandardMaterial({
      map: defaultSkin,
      bumpMap: defaultBump,
      bumpScale: 0.1,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.legMatR = this.legMatL.clone();

    // Left leg pivot
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, -0.25, 0);
    this.leftLeg = new THREE.Mesh(GEO.leg, this.legMatL);
    this.leftLeg.position.y = -0.2;
    this.leftLegPivot.add(this.leftLeg);
    this.group.add(this.leftLegPivot);

    // Right leg pivot
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, -0.25, 0);
    this.rightLeg = new THREE.Mesh(GEO.leg, this.legMatR);
    this.rightLeg.position.y = -0.2;
    this.rightLegPivot.add(this.rightLeg);
    this.group.add(this.rightLegPivot);

    // --- Tank-specific: shoulder growths/tumors ---
    this.growthMat = new THREE.MeshStandardMaterial({
      color: 0x6a4a6a,
      roughness: 0.65,
      metalness: 0.1,
      bumpMap: defaultBump,
      bumpScale: 0.2,
    });
    this.growthL = new THREE.Mesh(GEO.growth, this.growthMat);
    this.growthL.position.set(-0.22, 0.32, 0);
    this.growthL.scale.set(1, 0.8, 0.9);
    this.growthL.visible = false;
    this.group.add(this.growthL);

    this.growthR = new THREE.Mesh(GEO.growth, this.growthMat.clone());
    this.growthR.position.set(0.22, 0.3, 0.05);
    this.growthR.scale.set(0.9, 0.7, 1);
    this.growthR.visible = false;
    this.group.add(this.growthR);

    // --- Tank-specific: exposed rib bones ---
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xccbbaa,
      roughness: 0.5,
      metalness: 0.1,
    });
    this.ribs = [];
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(GEO.rib, ribMat);
      rib.position.set(0.2, 0.08 - i * 0.08, 0.04);
      rib.rotation.z = 0.3 + i * 0.12;
      rib.rotation.y = -0.2;
      rib.visible = false;
      this.group.add(rib);
      this.ribs.push(rib);
    }

    // Glow - eerie
    this.light = new THREE.PointLight(0x5a7a3a, 0.15, 3);
    this.group.add(this.light);

    // Health bar
    const hbBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this.healthBarBg = new THREE.Mesh(GEO.hpBar, hbBgMat);
    this.healthBarBg.position.y = 0.75;
    this.group.add(this.healthBarBg);

    const hbFillGeo = GEO.hpBar.clone();
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

    const v = this.variant;

    // --- Assign skin textures per type ---
    const skin = ZombieTextures.getSkin(type, v);
    const bump = ZombieTextures.getBump(type, v);

    this.bodyMat.map = skin;
    this.bodyMat.bumpMap = bump;
    this.bodyMat.color.set(0xffffff);
    this.bodyMat.emissive.set(config.emissive);
    this.bodyMat.emissiveIntensity = 0.15;

    this.headMat.map = skin;
    this.headMat.bumpMap = bump;
    this.headMat.color.set(0xffffff);

    this.armMatL.map = skin;
    this.armMatL.bumpMap = bump;
    this.armMatL.color.set(0xffffff);
    this.armMatL.emissive.set(config.emissive);
    this.armMatL.emissiveIntensity = 0.1;
    this.armMatR.map = skin;
    this.armMatR.bumpMap = bump;
    this.armMatR.color.set(0xffffff);
    this.armMatR.emissive.set(config.emissive);
    this.armMatR.emissiveIntensity = 0.1;

    this.legMatL.map = skin;
    this.legMatL.bumpMap = bump;
    this.legMatL.color.set(0xffffff);
    this.legMatR.map = skin;
    this.legMatR.bumpMap = bump;
    this.legMatR.color.set(0xffffff);

    this._origColor.set(0xffffff);
    this._origEmissive.set(config.emissive);
    this.light.color.set(config.color);

    // --- Eye color per type ---
    const ec = config.eyeColor || 0xaacc00;
    this.eyeMatL.color.set(ec);
    this.eyeMatR.color.set(ec);

    // --- Clothing (runners have no shirt - exposed torso) ---
    this.clothing.visible = type !== 'runner';

    // --- Tank-specific meshes ---
    const isTank = type === 'tank';
    this.growthL.visible = isTank;
    this.growthR.visible = isTank;
    for (const rib of this.ribs) rib.visible = isTank;

    // --- Per-type body proportions ---
    if (type === 'runner') {
      // Lean, gaunt build
      this.torso.scale.set(0.8, 1.0, 0.75);
      this.leftArm.scale.set(0.85, 1.1, 0.85);
      this.rightArm.scale.set(0.85, 0.7, 0.85); // shorter right arm (partially missing)
      this.leftLeg.scale.set(0.85, 1.05, 0.85);
      this.rightLeg.scale.set(0.85, 1.05, 0.85);
      this.head.scale.setScalar(0.95);
      this.clothing.scale.set(1, 1, 1);
    } else if (type === 'tank') {
      // Hulking, bloated build
      this.torso.scale.set(1.3, 1.1, 1.25);
      this.leftArm.scale.set(1.35, 1.1, 1.35);
      this.rightArm.scale.set(1.35, 1.1, 1.35);
      this.leftLeg.scale.set(1.2, 1.05, 1.2);
      this.rightLeg.scale.set(1.2, 1.05, 1.2);
      this.head.scale.setScalar(1.1);
      this.clothing.scale.set(1.25, 1.1, 1.2);
    } else {
      // Walker - standard proportions
      this.torso.scale.set(1, 1, 1);
      this.leftArm.scale.set(1, 1, 1);
      this.rightArm.scale.set(1, 1, 1);
      this.leftLeg.scale.set(1, 1, 1);
      this.rightLeg.scale.set(1, 1, 1);
      this.head.scale.setScalar(1);
      this.clothing.scale.set(1, 1, 1);
    }

    const s = config.size;
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
        this.bodyMat.emissiveIntensity = 0.15;
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

    // Reset torso
    this.torso.rotation.x = 0;
    this.torso.position.y = 0;
    this.torso.scale.set(1, 1, 1);

    // Reset head
    this.head.rotation.set(0, 0, 0);
    this.head.scale.setScalar(1);

    // Reset arm pivots and scales
    this.leftArmPivot.rotation.set(0, 0, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
    this.leftArm.scale.set(1, 1, 1);
    this.rightArm.scale.set(1, 1, 1);

    // Reset leg pivots and scales
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);
    this.leftLeg.scale.set(1, 1, 1);
    this.rightLeg.scale.set(1, 1, 1);

    // Reset clothing
    this.clothing.scale.set(1, 1, 1);
    this.clothing.visible = true;

    // Hide type-specific meshes
    this.growthL.visible = false;
    this.growthR.visible = false;
    for (const rib of this.ribs) rib.visible = false;

    // Reset materials
    this.bodyMat.emissive.copy(this._origEmissive);
    this.bodyMat.emissiveIntensity = 0.15;
  }

  // Bounding sphere radius for collision
  get radius() {
    return (this.config?.size || 0.5) * 0.8;
  }
}
