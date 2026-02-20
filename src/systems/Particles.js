import * as THREE from 'three';

const MAX_PARTICLES = 600;

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
    // Blood splatter on hit
    const count = 10;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2,
      ).normalize();

      const isBlood = i < 6;
      p.activate({
        position: position.clone(),
        velocity: dir.multiplyScalar(2 + Math.random() * 4),
        color: isBlood ? (Math.random() > 0.5 ? 0x8a1111 : 0x660808) : color,
        size: isBlood ? 0.04 + Math.random() * 0.06 : 0.03 + Math.random() * 0.05,
        life: 0.3 + Math.random() * 0.3,
        gravity: -8,
      });
    }
  }

  spawnExplosion(position, color = 0xff8800) {
    // Death explosion - bigger, bloodier
    const count = 25;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.2,
        (Math.random() - 0.5) * 2,
      ).normalize();

      const speed = 2 + Math.random() * 7;
      let pColor;
      let pSize;

      if (i < 4) {
        // Core flash
        pColor = 0xffddaa;
        pSize = 0.15 + Math.random() * 0.1;
      } else if (i < 14) {
        // Blood chunks
        pColor = Math.random() > 0.3 ? 0x8a1111 : 0x550808;
        pSize = 0.05 + Math.random() * 0.08;
      } else {
        // Debris/bone
        pColor = Math.random() > 0.5 ? 0xccbbaa : color;
        pSize = 0.03 + Math.random() * 0.06;
      }

      p.activate({
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
        )),
        velocity: dir.multiplyScalar(speed),
        color: pColor,
        size: pSize,
        life: 0.4 + Math.random() * 0.5,
        gravity: -6,
      });
    }
  }

  spawnMuzzleFlash(position, direction) {
    const count = 4;
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
        velocity: spread.multiplyScalar(8 + Math.random() * 5),
        color: i === 0 ? 0xffffff : 0xffaa44,
        size: 0.03 + Math.random() * 0.04,
        life: 0.06 + Math.random() * 0.08,
        gravity: 0,
      });
    }
  }

  spawnScorePopup(position, points) {
    // Floating score text sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 32px Courier New';
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText(`+${points}`, 64, 40);
    ctx.fillText(`+${points}`, 64, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.position.y += 0.5;
    sprite.scale.set(1.5, 0.75, 1);
    this.scene.add(sprite);

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

    // Stop at ground level
    if (this.mesh.position.y < 0.02) {
      this.mesh.position.y = 0.02;
      this.velocity.y = 0;
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
    }

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
