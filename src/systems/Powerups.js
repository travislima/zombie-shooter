import * as THREE from 'three';

const DROP_CHANCE = 0.3; // 30% chance per kill
const PICKUP_RADIUS = 1.5;
const MAX_PICKUPS = 20;
const LIFETIME = 15; // seconds before despawn

const POWERUP_TYPES = {
  health: {
    color: 0x44ff44,
    emissive: 0x22aa22,
    label: '+HEALTH',
    apply: (player) => {
      player.heal(30);
    },
  },
  speed: {
    color: 0x4488ff,
    emissive: 0x2244aa,
    label: 'SPEED BOOST',
    duration: 5,
    apply: (player) => {
      player.speedMultiplier = 1.6;
    },
    remove: (player) => {
      player.speedMultiplier = 1;
    },
  },
  damage: {
    color: 0xff4444,
    emissive: 0xaa2222,
    label: '2X DAMAGE',
    duration: 8,
    apply: (player, weapon) => {
      weapon.damageMultiplier *= 2;
    },
    remove: (player, weapon) => {
      weapon.damageMultiplier = Math.max(1, weapon.damageMultiplier / 2);
    },
  },
};

// Weighted random selection
const DROP_TABLE = [
  { type: 'health', weight: 50 },
  { type: 'speed', weight: 25 },
  { type: 'damage', weight: 25 },
];

const TOTAL_WEIGHT = DROP_TABLE.reduce((sum, e) => sum + e.weight, 0);

export class PowerupManager {
  constructor(scene) {
    this.scene = scene;
    this.pickups = [];
    this.activeEffects = []; // timed effects
  }

  // Called when an enemy dies - maybe spawn a pickup
  onEnemyKilled(position) {
    if (Math.random() > DROP_CHANCE) return;
    if (this.pickups.length >= MAX_PICKUPS) return;

    const type = this._rollDrop();
    this._spawnPickup(type, position);
  }

  _rollDrop() {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const entry of DROP_TABLE) {
      roll -= entry.weight;
      if (roll <= 0) return entry.type;
    }
    return 'health';
  }

  _spawnPickup(type, position) {
    const config = POWERUP_TYPES[type];
    if (!config) return;

    // Create 3D pickup
    const group = new THREE.Group();

    // Main gem shape
    const geo = new THREE.OctahedronGeometry(0.25, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.emissive,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Glow light
    const light = new THREE.PointLight(config.color, 0.5, 4);
    group.add(light);

    // Position at ground level
    group.position.set(position.x, 0.5, position.z);
    this.scene.add(group);

    this.pickups.push({
      type,
      config,
      group,
      mesh,
      light,
      mat,
      age: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }

  update(dt, playerPos, player, weapon, hud) {
    // Update active timed effects
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.remaining -= dt;
      if (effect.remaining <= 0) {
        if (effect.config.remove) {
          effect.config.remove(player, weapon);
        }
        this.activeEffects.splice(i, 1);
      }
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.age += dt;
      pickup.phase += dt * 3;

      // Bob and spin animation
      pickup.group.position.y = 0.5 + Math.sin(pickup.phase) * 0.15;
      pickup.mesh.rotation.y += dt * 2;
      pickup.mesh.rotation.x = Math.sin(pickup.phase * 0.7) * 0.3;

      // Pulse glow
      pickup.light.intensity = 0.4 + Math.sin(pickup.phase * 2) * 0.2;

      // Blink when about to despawn
      if (pickup.age > LIFETIME - 3) {
        pickup.mat.opacity = 0.5 + Math.sin(pickup.age * 10) * 0.4;
      }

      // Check player pickup
      if (playerPos) {
        const dist = pickup.group.position.distanceTo(
          new THREE.Vector3(playerPos.x, 0.5, playerPos.z)
        );
        if (dist < PICKUP_RADIUS) {
          this._collectPickup(pickup, player, weapon, hud);
          this.scene.remove(pickup.group);
          this.pickups.splice(i, 1);
          continue;
        }
      }

      // Despawn
      if (pickup.age > LIFETIME) {
        this.scene.remove(pickup.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  _collectPickup(pickup, player, weapon, hud) {
    const config = pickup.config;

    // Apply effect
    config.apply(player, weapon);

    // If timed effect, track it
    if (config.duration) {
      // Remove existing same-type effect
      this.activeEffects = this.activeEffects.filter(e => {
        if (e.type === pickup.type) {
          if (e.config.remove) e.config.remove(player, weapon);
          return false;
        }
        return true;
      });
      this.activeEffects.push({
        type: pickup.type,
        config,
        remaining: config.duration,
      });
    }

    // Show HUD notification
    if (hud) {
      hud.showPickupNotification(config.label);
    }
  }

  reset() {
    for (const pickup of this.pickups) {
      this.scene.remove(pickup.group);
    }
    this.pickups.length = 0;
    this.activeEffects.length = 0;
  }
}
