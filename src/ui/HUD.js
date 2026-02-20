export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      healthFill: document.getElementById('health-fill'),
      shieldFill: document.getElementById('shield-fill'),
      ammoCount: document.getElementById('ammo-count'),
      scoreVal: document.getElementById('score-val'),
      waveVal: document.getElementById('wave-val'),
      comboDisplay: document.getElementById('combo-display'),
      comboVal: document.getElementById('combo-val'),
      enemiesVal: document.getElementById('enemies-val'),
      hitMarker: document.getElementById('hit-marker'),
      damageVignette: document.getElementById('damage-vignette'),
      waveAnnounce: document.getElementById('wave-announce'),
      waveAnnounceNum: document.getElementById('wave-announce-num'),
      waveAnnounceSub: document.getElementById('wave-announce-sub'),
      weaponName: document.getElementById('weapon-name'),
      pickupNotify: document.getElementById('pickup-notify'),
    };

    this.hitMarkerTimer = 0;
    this.damageVignetteTimer = 0;
    this.screenShakeAmount = 0;
    this.displayedScore = 0;
    this.pickupTimer = 0;
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  update(dt, state) {
    // Health
    const healthPct = (state.health / state.maxHealth) * 100;
    this.el.healthFill.style.width = healthPct + '%';
    if (healthPct > 60) {
      this.el.healthFill.style.background = '#0f4';
    } else if (healthPct > 30) {
      this.el.healthFill.style.background = '#fa0';
    } else {
      this.el.healthFill.style.background = '#f44';
    }

    // Shield
    const shieldPct = (state.shield / state.maxShield) * 100;
    this.el.shieldFill.style.width = shieldPct + '%';

    // Ammo
    const ammoEl = this.el.ammoCount;
    if (state.reloading) {
      ammoEl.textContent = 'RELOADING';
      ammoEl.className = 'ammo-count reloading';
    } else {
      ammoEl.textContent = state.ammo;
      ammoEl.className = 'ammo-count' + (state.ammo <= 5 ? ' low' : '');
    }

    // Weapon name
    if (this.el.weaponName && state.weaponName) {
      this.el.weaponName.textContent = state.weaponName;
    }

    // Score (animated)
    if (this.displayedScore < state.score) {
      const diff = state.score - this.displayedScore;
      this.displayedScore += Math.ceil(diff * Math.min(1, dt * 8));
      if (this.displayedScore > state.score) this.displayedScore = state.score;
    }
    this.el.scoreVal.textContent = this.displayedScore.toLocaleString();

    // Wave
    this.el.waveVal.textContent = state.wave;

    // Enemies
    this.el.enemiesVal.textContent = state.enemyCount;

    // Combo
    if (state.combo > 1) {
      this.el.comboDisplay.classList.add('active');
      this.el.comboVal.textContent = `x${state.comboMultiplier.toFixed(1)} (${state.combo})`;
    } else {
      this.el.comboDisplay.classList.remove('active');
    }

    // Hit marker
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      this.el.hitMarker.style.opacity = Math.max(0, this.hitMarkerTimer / 0.15);
    }

    // Damage vignette
    if (this.damageVignetteTimer > 0) {
      this.damageVignetteTimer -= dt;
      this.el.damageVignette.style.opacity = Math.max(0, this.damageVignetteTimer / 0.4);
    }

    // Pickup notification fade
    if (this.pickupTimer > 0) {
      this.pickupTimer -= dt;
      if (this.el.pickupNotify) {
        this.el.pickupNotify.style.opacity = Math.min(1, this.pickupTimer / 0.3);
        if (this.pickupTimer <= 0) {
          this.el.pickupNotify.style.opacity = 0;
        }
      }
    }

    // Screen shake
    if (this.screenShakeAmount > 0) {
      this.screenShakeAmount *= Math.pow(0.001, dt);
      if (this.screenShakeAmount < 0.01) this.screenShakeAmount = 0;
    }
  }

  showHitMarker(killed) {
    this.hitMarkerTimer = 0.15;
    this.el.hitMarker.style.opacity = 1;
    const color = killed ? '#ff0' : '#fff';
    this.el.hitMarker.querySelectorAll('.hm-line').forEach(l => {
      l.style.background = color;
    });
  }

  showDamageVignette() {
    this.damageVignetteTimer = 0.4;
    this.el.damageVignette.style.opacity = 0.5;
  }

  showPickupNotification(label) {
    if (!this.el.pickupNotify) return;
    this.el.pickupNotify.textContent = label;
    this.el.pickupNotify.style.opacity = 1;
    this.pickupTimer = 2;
  }

  addScreenShake(amount) {
    this.screenShakeAmount = Math.min(1, this.screenShakeAmount + amount);
  }

  getScreenShakeOffset() {
    if (this.screenShakeAmount <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.screenShakeAmount * 0.02,
      y: (Math.random() - 0.5) * this.screenShakeAmount * 0.02,
    };
  }

  showWaveAnnouncement(wave, subtext) {
    this.el.waveAnnounceNum.textContent = `WAVE ${wave}`;
    this.el.waveAnnounceSub.textContent = subtext;
    this.el.waveAnnounce.classList.add('visible');

    setTimeout(() => {
      this.el.waveAnnounce.classList.remove('visible');
    }, 2000);
  }
}
