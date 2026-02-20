import * as THREE from 'three';

export class Weapon {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.magazineSize = 20;
    this.ammo = this.magazineSize;
    this.fireRate = 4; // shots per second
    this.reloadTime = 1.5;
    this.projectileSpeed = 50;
    this.damage = 10;

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
  }

  _createMuzzleFlash() {
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0 });
    const flash = new THREE.Mesh(geo, mat);
    flash.layers.set(1); // separate layer so it's always visible
    return flash;
  }

  _createWeaponModel() {
    const group = new THREE.Group();

    // Gun body
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.06, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.8, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.z = -0.15;
    group.add(body);

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.2, 8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.9, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.4;
    group.add(barrel);

    // Glow tip
    const tipGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.z = -0.5;
    group.add(tip);

    // Add muzzle flash to tip position
    this.muzzleFlash.position.z = -0.52;
    group.add(this.muzzleFlash);

    return group;
  }

  attachToCamera(camera) {
    // Position weapon in bottom right of view
    this.weaponModel.position.set(0.25, -0.2, -0.3);
    camera.add(this.weaponModel);
  }

  reset() {
    this.ammo = this.magazineSize;
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.weaponKickback = 0;
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
    this.fireCooldown = 1 / this.fireRate;
    this.shotsFired++;
    this.weaponKickback = 1;

    // Muzzle flash
    this.muzzleFlashTimer = 0.05;
    this.muzzleFlash.material.opacity = 1;

    // Auto-reload on empty
    if (this.ammo <= 0) {
      this.startReload();
    }

    // Return projectile spawn info
    const origin = this.camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    return {
      origin,
      direction,
      speed: this.projectileSpeed,
      damage: this.damage,
      isPlayer: true,
    };
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

  get accuracy() {
    return this.shotsFired > 0 ? (this.shotsHit / this.shotsFired * 100) : 0;
  }
}
