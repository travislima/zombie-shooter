import * as THREE from 'three';

const ARENA_RADIUS = 14; // slightly less than actual arena for boundary margin
const MOVE_SPEED = 6;
const MOUSE_SENSITIVITY = 0.002;
const EYE_HEIGHT = 1.7;
const BOB_SPEED = 10;
const BOB_AMOUNT = 0.03;

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.shield = 100;
    this.maxShield = 100;
    this.shieldRegenDelay = 3;
    this.shieldRegenRate = 5; // per second
    this.timeSinceDamage = 999;

    this.alive = true;
    this.bobPhase = 0;
    this.speedMultiplier = 1;

    // Stats
    this.damageDealt = 0;
    this.damageTaken = 0;
  }

  reset() {
    this.position.set(0, EYE_HEIGHT, 0);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.timeSinceDamage = 999;
    this.alive = true;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.bobPhase = 0;
    this.speedMultiplier = 1;
  }

  update(dt, input) {
    if (!this.alive) return;

    // Mouse look
    const mouse = input.consumeMouse();
    this.yaw -= mouse.dx * MOUSE_SENSITIVITY;
    this.pitch -= mouse.dy * MOUSE_SENSITIVITY;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    // Movement
    const moveDir = new THREE.Vector3();
    if (input.forward) moveDir.z -= 1;
    if (input.backward) moveDir.z += 1;
    if (input.left) moveDir.x -= 1;
    if (input.right) moveDir.x += 1;

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) {
      moveDir.normalize();
      // Rotate by yaw
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const rx = moveDir.x * cos + moveDir.z * sin;
      const rz = -moveDir.x * sin + moveDir.z * cos;
      moveDir.x = rx;
      moveDir.z = rz;
    }

    const speed = (input.shift ? MOVE_SPEED * 1.4 : MOVE_SPEED) * this.speedMultiplier;
    const targetVel = moveDir.multiplyScalar(speed);

    // Smooth acceleration
    const accel = 15;
    this.velocity.x += (targetVel.x - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (targetVel.z - this.velocity.z) * Math.min(1, accel * dt);

    // Apply movement
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Arena boundary (circular)
    const dist = Math.sqrt(this.position.x * this.position.x + this.position.z * this.position.z);
    if (dist > ARENA_RADIUS) {
      const scale = ARENA_RADIUS / dist;
      this.position.x *= scale;
      this.position.z *= scale;
      // Push velocity inward
      const nx = this.position.x / dist;
      const nz = this.position.z / dist;
      const dot = this.velocity.x * nx + this.velocity.z * nz;
      if (dot > 0) {
        this.velocity.x -= nx * dot;
        this.velocity.z -= nz * dot;
      }
    }

    // Camera bob
    if (isMoving) {
      this.bobPhase += BOB_SPEED * dt;
      this.position.y = EYE_HEIGHT + Math.sin(this.bobPhase) * BOB_AMOUNT;
    } else {
      this.position.y += (EYE_HEIGHT - this.position.y) * Math.min(1, 5 * dt);
      this.bobPhase = 0;
    }

    // Shield regen
    this.timeSinceDamage += dt;
    if (this.timeSinceDamage > this.shieldRegenDelay && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * dt);
    }

    // Update camera
    this.camera.position.copy(this.position);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.timeSinceDamage = 0;
    this.damageTaken += amount;

    // Shield absorbs first
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }

    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  // Get the forward direction the player is looking
  getForward() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  // Get position at ground level (for enemy targeting)
  getGroundPos() {
    return new THREE.Vector3(this.position.x, 0, this.position.z);
  }
}
