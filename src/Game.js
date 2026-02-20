import * as THREE from 'three';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { TouchControls } from './core/TouchControls.js';
import { Player } from './entities/Player.js';
import { Weapon, WEAPON_TYPES } from './entities/Weapon.js';
import { ProjectilePool } from './entities/Projectile.js';
import { EnemyManager } from './entities/Enemy.js';
import { Arena } from './world/Arena.js';
import { WaveManager } from './systems/WaveManager.js';
import { Combat } from './systems/Combat.js';
import { Particles } from './systems/Particles.js';
import { PowerupManager } from './systems/Powerups.js';
import { HUD } from './ui/HUD.js';
import { Screens } from './ui/Screens.js';
import { Shop } from './ui/Shop.js';

const STATES = {
  LOADING: 'loading',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  SHOP: 'shop',
  GAME_OVER: 'game_over',
};

export class Game {
  constructor() {
    this.state = STATES.LOADING;
    this.clock = new THREE.Clock();
    this.renderer = null;
    this.scene = null;
    this.camera = null;

    // Systems
    this.input = new Input();
    this.audio = new Audio();
    this.hud = new HUD();
    this.screens = new Screens();
    this.shop = new Shop();
    this.touchControls = new TouchControls(this.input);

    // Game objects (initialized in init)
    this.player = null;
    this.weapon = null;
    this.projectiles = null;
    this.enemies = null;
    this.arena = null;
    this.waveManager = null;
    this.combat = null;
    this.particles = null;
    this.powerups = null;
  }

  init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    document.body.insertBefore(this.renderer.domElement, document.body.firstChild);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.scene.add(this.camera);

    // Game objects
    this.player = new Player(this.camera);
    this.weapon = new Weapon(this.scene, this.camera);
    this.weapon.attachToCamera(this.camera);
    this.projectiles = new ProjectilePool(this.scene);
    this.enemies = new EnemyManager(this.scene);
    this.arena = new Arena(this.scene);
    this.waveManager = new WaveManager(this.enemies);
    this.combat = new Combat();
    this.particles = new Particles(this.scene);
    this.powerups = new PowerupManager(this.scene);

    // Screen callbacks
    this.screens.init();
    this.screens.onPlay = () => this._startGame();
    this.screens.onResume = () => this._resumeGame();
    this.screens.onQuit = () => this._quitToMenu();
    this.screens.onRestart = () => this._startGame();
    this.screens.onMenu = () => this._quitToMenu();

    // Shop callbacks
    this.shop.onClose = () => this._onShopClosed();

    // Window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Pointer lock change handling
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === STATES.PLAYING) {
        if (!this.touchControls.isTouchDevice) {
          this._pauseGame();
        }
      }
    });

    // "Loading" - we have no external assets, so just fake a brief load
    this.screens.showLoading();
    let progress = 0;
    const loadInterval = setInterval(() => {
      progress += 15;
      this.screens.setLoadingProgress(Math.min(100, progress));
      if (progress >= 100) {
        clearInterval(loadInterval);
        setTimeout(() => {
          this.state = STATES.MENU;
          this.screens.showMenu();
        }, 300);
      }
    }, 80);

    // Start game loop
    this._loop();
  }

  _startGame() {
    this.audio.init();
    this.audio.resume();
    this.audio.playClick();

    // Reset everything
    this.player.reset();
    this.weapon.reset();
    this.projectiles.reset();
    this.enemies.reset();
    this.waveManager.reset();
    this.combat.reset();
    this.particles.reset();
    this.powerups.reset();
    this.shop.reset();
    this.hud.displayedScore = 0;

    this.screens.hideAll();
    this.hud.show();

    // Request pointer lock (or enable touch)
    if (this.touchControls.isTouchDevice) {
      this.touchControls.enable();
    } else {
      this.input.requestLock(this.renderer.domElement);
    }
    this.state = STATES.PLAYING;

    this.audio.startMusic();

    // Start first wave
    this.clock.getDelta(); // reset delta
    this._beginWave();
  }

  _pauseGame() {
    if (this.state !== STATES.PLAYING) return;
    this.state = STATES.PAUSED;
    this.screens.showPause();
    this.audio.stopMusic();
    this.touchControls.disable();
  }

  _resumeGame() {
    this.audio.playClick();
    this.screens.hidePause();
    if (this.touchControls.isTouchDevice) {
      this.touchControls.enable();
    } else {
      this.input.requestLock(this.renderer.domElement);
    }
    this.state = STATES.PLAYING;
    this.audio.startMusic();
    this.clock.getDelta(); // reset delta to avoid jump
  }

  _quitToMenu() {
    this.audio.playClick();
    this.audio.stopMusic();
    this.state = STATES.MENU;
    this.input.exitLock();
    this.touchControls.disable();
    this.hud.hide();
    this.screens.showMenu();
    this.enemies.reset();
    this.projectiles.reset();
    this.particles.reset();
    this.powerups.reset();
  }

  _gameOver() {
    this.state = STATES.GAME_OVER;
    this.input.exitLock();
    this.touchControls.disable();
    this.hud.hide();
    this.audio.stopMusic();
    this.audio.playGameOver();

    this.screens.showGameOver({
      score: this.combat.score,
      wave: this.waveManager.wave,
      kills: this.combat.totalKills,
      accuracy: this.weapon.accuracy,
      highestCombo: this.combat.highestCombo,
    });
  }

  _startNextWave() {
    // Show shop between waves (after wave 1)
    if (this.waveManager.wave >= 1 && this.combat.score > 0) {
      this.state = STATES.SHOP;
      this.input.exitLock();
      this.touchControls.disable();
      this.hud.hide();
      this.shop.open(this.combat.score);
      return;
    }

    this._beginWave();
  }

  _onShopClosed() {
    // Apply upgrades
    this.weapon.applyUpgrades(this.shop.levels);

    // Apply health/shield upgrades
    const healthBonus = (this.shop.levels.maxHealth || 0) * 25;
    this.player.maxHealth = 100 + healthBonus;
    this.player.health = Math.min(this.player.health, this.player.maxHealth);

    const shieldBonus = (this.shop.levels.shieldRegen || 0) * 2;
    this.player.shieldRegenRate = 5 + shieldBonus;

    // Deduct spent points
    this.combat.score = this.shop.pointsRemaining;
    this.hud.displayedScore = this.combat.score;

    // Resume game
    this.hud.show();
    if (this.touchControls.isTouchDevice) {
      this.touchControls.enable();
    } else {
      this.input.requestLock(this.renderer.domElement);
    }
    this.state = STATES.PLAYING;
    this._beginWave();
  }

  _beginWave() {
    const wave = this.waveManager.startNextWave();
    this.hud.showWaveAnnouncement(wave, this.waveManager.getWaveSubtext());
    if (wave > 1) {
      this.audio.playWaveComplete();
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());

    const dt = Math.min(this.clock.getDelta(), 0.05); // cap delta time

    if (this.state === STATES.PLAYING) {
      this._updateGameplay(dt);
    }

    // Always render (for menu backgrounds etc)
    this.renderer.render(this.scene, this.camera);
  }

  _updateGameplay(dt) {
    // Touch controls
    this.touchControls.applyToInput();

    // Input handling
    if (this.input.consumeEsc()) {
      this._pauseGame();
      return;
    }

    if (this.input.consumeReload()) {
      this.weapon.startReload(this.audio);
    }

    // Player update
    this.player.update(dt, this.input);

    // Weapon update
    this.weapon.update(dt);

    // Shooting - weapon.fire() now returns array of shots
    if (this.input.mouseDown && this.weapon.canFire()) {
      const shots = this.weapon.fire();
      if (shots) {
        for (const shotInfo of shots) {
          this.projectiles.spawn(
            shotInfo.origin,
            shotInfo.direction,
            shotInfo.speed,
            shotInfo.damage,
            true,
          );
        }
        this.audio.playShoot();
        this.hud.addScreenShake(0.15);
        const firstShot = shots[0];
        this.particles.spawnMuzzleFlash(
          firstShot.origin.clone().add(firstShot.direction.clone().multiplyScalar(1)),
          firstShot.direction,
        );
      }
    }

    // Clear touch input after processing
    this.touchControls.clearInput();

    // Update projectiles
    this.projectiles.update(dt);

    // Update enemies (no projectiles needed - melee only)
    this.enemies.update(dt, this.player.position);

    // Combat checks - player projectiles vs enemies
    const hits = this.combat.checkPlayerProjectiles(
      this.projectiles.getActive(),
      this.enemies.getActive(),
      this.weapon,
      this.audio,
      this.particles,
      this.camera,
    );

    for (const hit of hits) {
      this.hud.showHitMarker(hit.killed);
      if (hit.killed) {
        this.hud.addScreenShake(0.3);
        this.waveManager.onEnemyKilled();
        this.particles.spawnScorePopup(hit.position, hit.points);
        // Chance to drop powerup
        this.powerups.onEnemyKilled(hit.position);
      }
    }

    // Enemy melee vs player (zombies damage on contact)
    const playerHit = this.combat.checkEnemyMelee(
      this.enemies.getActive(),
      this.player,
      this.audio,
    );
    if (playerHit) {
      this.audio.playDamage();
      this.hud.showDamageVignette();
      this.hud.addScreenShake(0.3);

      if (!this.player.alive) {
        this._gameOver();
        return;
      }
    }

    // Powerups
    this.powerups.update(dt, this.player.position, this.player, this.weapon, this.hud);

    // Combat system update (combos etc)
    this.combat.update(dt);

    // Wave manager
    this.waveManager.update(dt);
    if (this.waveManager.isIdle && this.player.alive) {
      this._startNextWave();
    }

    // Particles
    this.particles.update(dt);

    // Arena
    this.arena.update(dt);

    // Screen shake
    const shake = this.hud.getScreenShakeOffset();
    this.camera.position.x += shake.x;
    this.camera.position.y += shake.y;

    // HUD
    const weaponConfig = WEAPON_TYPES[this.weapon.currentType];
    this.hud.update(dt, {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      shield: this.player.shield,
      maxShield: this.player.maxShield,
      ammo: this.weapon.ammo,
      reloading: this.weapon.reloading,
      score: this.combat.score,
      wave: this.waveManager.wave,
      combo: this.combat.combo,
      comboMultiplier: this.combat.comboMultiplier,
      enemyCount: this.enemies.count,
      weaponName: weaponConfig ? weaponConfig.name : 'PISTOL',
    });
  }
}
