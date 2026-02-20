import * as THREE from 'three';

const MAX_PARTICLES = 500;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    // Pre-create particle pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(new Particle(scene));
    }
  }

  _getParticle() {
    return this.particles.find(p => !p.active);
  }

  spawnHitEffect(position, color = 0x00ddff) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize();

      p.activate({
        position: position.clone(),
        velocity: dir.multiplyScalar(3 + Math.random() * 3),
        color,
        size: 0.05 + Math.random() * 0.08,
        life: 0.2 + Math.random() * 0.2,
        gravity: -2,
      });
    }
  }

  spawnExplosion(position, color = 0xff8800) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random(),
        (Math.random() - 0.5) * 2,
      ).normalize();

      const speed = 2 + Math.random() * 6;
      const isCore = i < 5;

      p.activate({
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
        )),
        velocity: dir.multiplyScalar(speed),
        color: isCore ? 0xffffff : color,
        size: isCore ? 0.15 : 0.05 + Math.random() * 0.1,
        life: 0.3 + Math.random() * 0.4,
        gravity: -3,
      });
    }
  }

  spawnMuzzleFlash(position, direction) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;

      const spread = new THREE.Vector3(
        direction.x + (Math.random() - 0.5) * 0.3,
        direction.y + (Math.random() - 0.5) * 0.3,
        direction.z + (Math.random() - 0.5) * 0.3,
      ).normalize();

      p.activate({
        position: position.clone(),
        velocity: spread.multiplyScalar(8 + Math.random() * 4),
        color: 0xffaa44,
        size: 0.03 + Math.random() * 0.04,
        life: 0.08 + Math.random() * 0.08,
        gravity: 0,
      });
    }
  }

  spawnScorePopup(position, points) {
    // Using a sprite for floating score text
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 32px Courier New';
    ctx.fillStyle = '#ffff00';
    ctx.textAlign = 'center';
    ctx.fillText(`+${points}`, 64, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.position.y += 0.5;
    sprite.scale.set(1.5, 0.75, 1);
    this.scene.add(sprite);

    // Animate and remove
    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 1) {
        this.scene.remove(sprite);
        texture.dispose();
        mat.dispose();
        return;
      }
      sprite.position.y += 0.02;
      mat.opacity = 1 - elapsed;
      requestAnimationFrame(animate);
    };
    animate();
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.active) p.update(dt);
    }
  }

  reset() {
    for (const p of this.particles) {
      if (p.active) p.deactivate();
    }
  }
}

class Particle {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.life = 0;
    this.maxLife = 0;
    this.velocity = new THREE.Vector3();
    this.gravity = 0;

    const geo = new THREE.SphereGeometry(0.05, 4, 4);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  activate({ position, velocity, color, size, life, gravity }) {
    this.active = true;
    this.life = life;
    this.maxLife = life;
    this.velocity.copy(velocity);
    this.gravity = gravity || 0;

    this.mat.color.set(color);
    this.mat.opacity = 1;
    this.mesh.position.copy(position);
    this.mesh.scale.setScalar(size / 0.05);
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;

    this.life -= dt;
    if (this.life <= 0) {
      this.deactivate();
      return;
    }

    // Move
    this.velocity.y += this.gravity * dt;
    this.mesh.position.addScaledVector(this.velocity, dt);

    // Fade
    const t = this.life / this.maxLife;
    this.mat.opacity = t;

    // Slow down
    this.velocity.multiplyScalar(1 - dt * 2);
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }
}
