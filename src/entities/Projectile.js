import * as THREE from 'three';

const POOL_SIZE = 80;
const MAX_DISTANCE = 100;

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.active = [];

    // Create pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const proj = new ProjectileInstance(scene);
      this.projectiles.push(proj);
    }
  }

  spawn(origin, direction, speed, damage, isPlayer) {
    // Find inactive projectile
    const proj = this.projectiles.find(p => !p.active);
    if (!proj) return null;

    proj.activate(origin, direction, speed, damage, isPlayer);
    this.active.push(proj);
    return proj;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const proj = this.active[i];
      proj.update(dt);

      if (!proj.active) {
        this.active.splice(i, 1);
      }
    }
  }

  getActive() {
    return this.active;
  }

  reset() {
    for (const proj of this.active) {
      proj.deactivate();
    }
    this.active.length = 0;
  }
}

class ProjectileInstance {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.position = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.speed = 0;
    this.damage = 0;
    this.isPlayer = true;
    this.distanceTraveled = 0;
    this.origin = new THREE.Vector3();

    // Mesh - small glowing sphere with trail
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    this.playerMat = new THREE.MeshBasicMaterial({ color: 0xffbb44 });
    this.enemyMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    this.mesh = new THREE.Mesh(geo, this.playerMat);
    this.mesh.visible = false;
    scene.add(this.mesh);

    // Point light for glow
    this.light = new THREE.PointLight(0xffbb44, 0.5, 5);
    this.light.visible = false;
    this.mesh.add(this.light);

    // Trail
    const trailGeo = new THREE.CylinderGeometry(0.02, 0.05, 0.5, 4);
    trailGeo.rotateX(Math.PI / 2);
    trailGeo.translate(0, 0, 0.25);
    this.trailPlayerMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
    this.trailEnemyMat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.4 });
    this.trail = new THREE.Mesh(trailGeo, this.trailPlayerMat);
    this.mesh.add(this.trail);
  }

  activate(origin, direction, speed, damage, isPlayer) {
    this.active = true;
    this.origin.copy(origin);
    this.position.copy(origin);
    this.direction.copy(direction).normalize();
    this.speed = speed;
    this.damage = damage;
    this.isPlayer = isPlayer;
    this.distanceTraveled = 0;

    this.mesh.material = isPlayer ? this.playerMat : this.enemyMat;
    this.trail.material = isPlayer ? this.trailPlayerMat : this.trailEnemyMat;
    this.light.color.set(isPlayer ? 0xffbb44 : 0xff4444);

    this.mesh.position.copy(origin);
    this.mesh.visible = true;
    this.light.visible = true;

    // Orient trail
    this.mesh.lookAt(origin.x + direction.x, origin.y + direction.y, origin.z + direction.z);
  }

  update(dt) {
    if (!this.active) return;

    const move = this.speed * dt;
    this.position.addScaledVector(this.direction, move);
    this.distanceTraveled += move;

    this.mesh.position.copy(this.position);

    // Deactivate if too far
    if (this.distanceTraveled > MAX_DISTANCE || this.position.y < -5) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
    this.light.visible = false;
  }
}
