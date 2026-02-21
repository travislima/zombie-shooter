import * as THREE from 'three';

const DUST_COUNT = 80;
const EMBER_COUNT = 20;
const MAX_DECALS = 40;

export class AmbientFX {
  constructor(scene) {
    this.scene = scene;
    this.dustParticles = [];
    this.emberParticles = [];
    this.decals = [];

    this._initDust();
    this._initEmbers();
  }

  _initDust() {
    const geo = new THREE.PlaneGeometry(0.04, 0.04);

    for (let i = 0; i < DUST_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x998877,
        transparent: true,
        opacity: 0.15 + Math.random() * 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Scatter in a cylinder above the arena
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 16;
      mesh.position.set(
        Math.cos(angle) * r,
        0.3 + Math.random() * 4,
        Math.sin(angle) * r,
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );

      this.scene.add(mesh);
      this.dustParticles.push({
        mesh,
        baseY: mesh.position.y,
        driftX: (Math.random() - 0.5) * 0.3,
        driftZ: (Math.random() - 0.5) * 0.3,
        bobSpeed: 0.3 + Math.random() * 0.5,
        bobAmount: 0.1 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.5,
      });
    }
  }

  _initEmbers() {
    const geo = new THREE.PlaneGeometry(0.025, 0.025);

    for (let i = 0; i < EMBER_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff6622 : 0xff8833,
        transparent: true,
        opacity: 0.4 + Math.random() * 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Start near fire barrel positions
      const firePos = Math.random() > 0.5
        ? { x: -5, z: -8 }
        : { x: -3, z: 10 };

      mesh.position.set(
        firePos.x + (Math.random() - 0.5) * 3,
        0.5 + Math.random() * 3,
        firePos.z + (Math.random() - 0.5) * 3,
      );

      this.scene.add(mesh);
      this.emberParticles.push({
        mesh,
        mat,
        originX: firePos.x,
        originZ: firePos.z,
        riseSpeed: 0.3 + Math.random() * 0.6,
        driftX: (Math.random() - 0.5) * 0.8,
        driftZ: (Math.random() - 0.5) * 0.8,
        phase: Math.random() * Math.PI * 2,
        flickerSpeed: 5 + Math.random() * 10,
      });
    }
  }

  spawnBloodDecal(position) {
    if (this.decals.length >= MAX_DECALS) {
      // Remove oldest
      const old = this.decals.shift();
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }

    // Procedural blood splatter texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Main splat
    const cx = 32, cy = 32;
    const r = 12 + Math.random() * 12;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(100, 10, 5, 0.7)');
    grad.addColorStop(0.6, 'rgba(70, 5, 0, 0.4)');
    grad.addColorStop(1, 'rgba(50, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Splatter drops
    for (let i = 0; i < 6; i++) {
      const dx = (Math.random() - 0.5) * 40;
      const dy = (Math.random() - 0.5) * 40;
      const dr = 3 + Math.random() * 5;
      const g2 = ctx.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, dr);
      g2.addColorStop(0, 'rgba(90, 8, 3, 0.6)');
      g2.addColorStop(1, 'rgba(50, 0, 0, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    const size = 1.0 + Math.random() * 1.5;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.set(position.x, 0.02, position.z);

    this.scene.add(mesh);
    this.decals.push({ mesh, mat, age: 0 });
  }

  update(dt) {
    // Dust
    for (const d of this.dustParticles) {
      d.phase += dt * d.bobSpeed;
      d.mesh.position.y = d.baseY + Math.sin(d.phase) * d.bobAmount;
      d.mesh.position.x += d.driftX * dt;
      d.mesh.position.z += d.driftZ * dt;
      d.mesh.rotation.z += d.spinSpeed * dt;

      // Wrap around if too far
      const dist = Math.sqrt(d.mesh.position.x ** 2 + d.mesh.position.z ** 2);
      if (dist > 18) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 5;
        d.mesh.position.x = Math.cos(angle) * r;
        d.mesh.position.z = Math.sin(angle) * r;
      }
    }

    // Embers
    for (const e of this.emberParticles) {
      e.phase += dt;
      e.mesh.position.y += e.riseSpeed * dt;
      e.mesh.position.x += e.driftX * dt;
      e.mesh.position.z += e.driftZ * dt;

      // Flicker
      e.mat.opacity = 0.3 + Math.sin(e.phase * e.flickerSpeed) * 0.3;

      // Reset when too high
      if (e.mesh.position.y > 5) {
        e.mesh.position.set(
          e.originX + (Math.random() - 0.5) * 2,
          0.5,
          e.originZ + (Math.random() - 0.5) * 2,
        );
        e.driftX = (Math.random() - 0.5) * 0.8;
        e.driftZ = (Math.random() - 0.5) * 0.8;
      }
    }

    // Decals - fade over time
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const decal = this.decals[i];
      decal.age += dt;
      // Slow fade after 20 seconds
      if (decal.age > 20) {
        decal.mat.opacity -= dt * 0.1;
        if (decal.mat.opacity <= 0) {
          this.scene.remove(decal.mesh);
          decal.mesh.geometry.dispose();
          decal.mesh.material.dispose();
          this.decals.splice(i, 1);
        }
      }
    }
  }

  reset() {
    for (const d of this.dustParticles) {
      this.scene.remove(d.mesh);
    }
    for (const e of this.emberParticles) {
      this.scene.remove(e.mesh);
    }
    for (const decal of this.decals) {
      this.scene.remove(decal.mesh);
      decal.mesh.geometry.dispose();
      decal.mesh.material.dispose();
    }
    this.dustParticles.length = 0;
    this.emberParticles.length = 0;
    this.decals.length = 0;

    this._initDust();
    this._initEmbers();
  }
}
