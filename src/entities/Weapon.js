import * as THREE from 'three';

// Weapon type definitions
export const WEAPON_TYPES = {
  pistol: {
    name: 'PISTOL',
    magazineSize: 20,
    fireRate: 4,
    reloadTime: 1.5,
    projectileSpeed: 50,
    damage: 10,
    pellets: 1,
    spread: 0,
    color: 0xffaa33,
    barrelColor: 0x556677,
    bodyColor: 0x334455,
  },
  shotgun: {
    name: 'SHOTGUN',
    magazineSize: 6,
    fireRate: 1.2,
    reloadTime: 2.0,
    projectileSpeed: 40,
    damage: 8,
    pellets: 6,
    spread: 0.12,
    color: 0xff6633,
    barrelColor: 0x665544,
    bodyColor: 0x553322,
  },
  smg: {
    name: 'SMG',
    magazineSize: 40,
    fireRate: 10,
    reloadTime: 1.8,
    projectileSpeed: 45,
    damage: 6,
    pellets: 1,
    spread: 0.04,
    color: 0x33aaff,
    barrelColor: 0x445566,
    bodyColor: 0x223344,
  },
  sniper: {
    name: 'SNIPER',
    magazineSize: 5,
    fireRate: 0.8,
    reloadTime: 2.5,
    projectileSpeed: 80,
    damage: 50,
    pellets: 1,
    spread: 0,
    color: 0x44ff44,
    barrelColor: 0x446644,
    bodyColor: 0x224422,
  },
};

export class Weapon {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Current weapon type
    this.currentType = 'pistol';
    this._applyType('pistol');

    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;

    // Stats
    this.shotsFired = 0;
    this.shotsHit = 0;

    // Muzzle flash
    this.muzzleFlash = this._createMuzzleFlash();
    this.muzzleFlashTimer = 0;

    // Weapon model (first person)
    this.weaponModel = this._createWeaponModel();
    this.weaponBobPhase = 0;
    this.weaponKickback = 0;

    // Upgrade multipliers
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.magSizeMultiplier = 1;
  }

  _applyType(type) {
    const config = WEAPON_TYPES[type];
    this.currentType = type;
    this.magazineSize = Math.round(config.magazineSize * this.magSizeMultiplier);
    this.ammo = this.magazineSize;
    this.fireRate = config.fireRate;
    this.reloadTime = config.reloadTime;
    this.projectileSpeed = config.projectileSpeed;
    this.damage = config.damage;
    this.pellets = config.pellets;
    this.spread = config.spread;
  }

  switchWeapon(type) {
    if (!WEAPON_TYPES[type] || type === this.currentType) return;
    this._applyType(type);
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this._updateWeaponModel();
  }

  _createMuzzleFlash() {
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0 });
    const flash = new THREE.Mesh(geo, mat);
    flash.layers.set(1);
    return flash;
  }

  _createWeaponModel() {
    const group = new THREE.Group();

    // Gun body
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.06, 0.35);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.8, roughness: 0.3 });
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.bodyMesh.position.z = -0.15;
    group.add(this.bodyMesh);

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.2, 8);
    this.barrelMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.9, roughness: 0.2 });
    this.barrelMesh = new THREE.Mesh(barrelGeo, this.barrelMat);
    this.barrelMesh.rotation.x = Math.PI / 2;
    this.barrelMesh.position.z = -0.4;
    group.add(this.barrelMesh);

    // Glow tip
    const tipGeo = new THREE.SphereGeometry(0.018, 8, 8);
    this.tipMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    this.tipMesh = new THREE.Mesh(tipGeo, this.tipMat);
    this.tipMesh.position.z = -0.5;
    group.add(this.tipMesh);

    // Muzzle flash
    this.muzzleFlash.position.z = -0.52;
    group.add(this.muzzleFlash);

    return group;
  }

  _updateWeaponModel() {
    const config = WEAPON_TYPES[this.currentType];
    this.bodyMat.color.set(config.bodyColor);
    this.barrelMat.color.set(config.barrelColor);
    this.tipMat.color.set(config.color);
    this.muzzleFlash.material.color.set(config.color);

    // Adjust model size per weapon type
    switch (this.currentType) {
      case 'shotgun':
        this.bodyMesh.scale.set(1.3, 1.2, 1.1);
        this.barrelMesh.scale.set(1.5, 1, 1.5);
        break;
      case 'smg':
        this.bodyMesh.scale.set(0.9, 0.9, 0.8);
        this.barrelMesh.scale.set(0.8, 0.9, 0.8);
        break;
      case 'sniper':
        this.bodyMesh.scale.set(0.8, 0.8, 1.4);
        this.barrelMesh.scale.set(0.7, 1.5, 0.7);
        break;
      default:
        this.bodyMesh.scale.set(1, 1, 1);
        this.barrelMesh.scale.set(1, 1, 1);
    }
  }

  attachToCamera(camera) {
    this.weaponModel.position.set(0.25, -0.2, -0.3);
    camera.add(this.weaponModel);
  }

  reset() {
    this.currentType = 'pistol';
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.magSizeMultiplier = 1;
    this._applyType('pistol');
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.weaponKickback = 0;
    this._updateWeaponModel();
  }

  update(dt) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo = this.magazineSize;
        this.reloading = false;
      }
    }

    // Muzzle flash decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlashTimer / 0.05);
      const s = 1 + this.muzzleFlashTimer * 10;
      this.muzzleFlash.scale.setScalar(s);
    }

    // Weapon kickback recovery
    this.weaponKickback *= Math.pow(0.001, dt);
    if (this.weaponKickback < 0.001) this.weaponKickback = 0;

    // Apply weapon animations
    this.weaponModel.position.z = -0.3 + this.weaponKickback * 0.05;
    this.weaponModel.rotation.x = -this.weaponKickback * 0.1;
  }

  canFire() {
    return !this.reloading && this.ammo > 0 && this.fireCooldown <= 0;
  }

  fire() {
    if (!this.canFire()) return null;

    this.ammo--;
    this.fireCooldown = 1 / (this.fireRate * this.fireRateMultiplier);
    this.shotsFired++;
    this.weaponKickback = 1;

    // Muzzle flash
    this.muzzleFlashTimer = 0.05;
    this.muzzleFlash.material.opacity = 1;

    // Auto-reload on empty
    if (this.ammo <= 0) {
      this.startReload();
    }

    // Return projectile spawn info (array for multi-pellet weapons)
    const origin = this.camera.position.clone();
    const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const effectiveDamage = Math.round(this.damage * this.damageMultiplier);

    const shots = [];
    for (let i = 0; i < this.pellets; i++) {
      const dir = baseDir.clone();
      if (this.spread > 0) {
        dir.x += (Math.random() - 0.5) * this.spread;
        dir.y += (Math.random() - 0.5) * this.spread;
        dir.z += (Math.random() - 0.5) * this.spread;
        dir.normalize();
      }
      shots.push({
        origin: origin.clone(),
        direction: dir,
        speed: this.projectileSpeed,
        damage: effectiveDamage,
        isPlayer: true,
      });
    }

    return shots;
  }

  startReload(audio) {
    if (this.reloading || this.ammo === this.magazineSize) return false;
    this.reloading = true;
    this.reloadTimer = this.reloadTime;
    if (audio) audio.playReload();
    return true;
  }

  registerHit() {
    this.shotsHit++;
  }

  // Apply shop upgrades
  applyUpgrades(upgrades) {
    this.damageMultiplier = 1 + (upgrades.damage || 0) * 0.2;
    this.fireRateMultiplier = 1 + (upgrades.fireRate || 0) * 0.15;
    this.magSizeMultiplier = 1 + (upgrades.magSize || 0) * 0.25;
    // Re-apply current weapon type to update magazine
    const config = WEAPON_TYPES[this.currentType];
    this.magazineSize = Math.round(config.magazineSize * this.magSizeMultiplier);
  }

  get accuracy() {
    return this.shotsFired > 0 ? (this.shotsHit / this.shotsFired * 100) : 0;
  }
}
