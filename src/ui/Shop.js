const UPGRADES = {
  damage: {
    name: 'DAMAGE',
    description: '+20% weapon damage',
    baseCost: 500,
    costScale: 1.5,
    maxLevel: 5,
  },
  fireRate: {
    name: 'FIRE RATE',
    description: '+15% fire rate',
    baseCost: 400,
    costScale: 1.5,
    maxLevel: 5,
  },
  magSize: {
    name: 'MAG SIZE',
    description: '+25% magazine capacity',
    baseCost: 300,
    costScale: 1.4,
    maxLevel: 5,
  },
  maxHealth: {
    name: 'MAX HEALTH',
    description: '+25 max health',
    baseCost: 400,
    costScale: 1.5,
    maxLevel: 5,
  },
  shieldRegen: {
    name: 'SHIELD REGEN',
    description: '+2 shield regen/sec',
    baseCost: 350,
    costScale: 1.4,
    maxLevel: 5,
  },
};

const WEAPONS = {
  shotgun: {
    name: 'SHOTGUN',
    description: '6-pellet spread, close range',
    cost: 800,
  },
  smg: {
    name: 'SMG',
    description: 'Fast fire, 40-round mag',
    cost: 600,
  },
  sniper: {
    name: 'SNIPER',
    description: 'High damage, 5-round mag',
    cost: 1000,
  },
};

export class Shop {
  constructor() {
    this.levels = {};
    for (const key of Object.keys(UPGRADES)) {
      this.levels[key] = 0;
    }
    this.ownedWeapons = new Set(['pistol']);
    this.selectedWeapon = null; // weapon to switch to on close

    this.el = document.getElementById('shop-screen');
    this.itemsEl = document.getElementById('shop-items');
    this.pointsEl = document.getElementById('shop-points');
    this.visible = false;

    this.onClose = null;
    this._availablePoints = 0;

    // Close button
    const closeBtn = document.getElementById('btn-shop-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  reset() {
    for (const key of Object.keys(UPGRADES)) {
      this.levels[key] = 0;
    }
    this.ownedWeapons = new Set(['pistol']);
    this.selectedWeapon = null;
  }

  getCost(upgradeKey) {
    const config = UPGRADES[upgradeKey];
    if (!config) return Infinity;
    return Math.round(config.baseCost * Math.pow(config.costScale, this.levels[upgradeKey]));
  }

  open(points) {
    this._availablePoints = points;
    this.selectedWeapon = null;
    this._render();
    this.el.classList.remove('hidden');
    this.visible = true;
  }

  close() {
    this.el.classList.add('hidden');
    this.visible = false;
    if (this.onClose) this.onClose();
  }

  _render() {
    this.pointsEl.textContent = this._availablePoints.toLocaleString();
    this.itemsEl.innerHTML = '';

    // Weapons section
    const weaponHeader = document.createElement('div');
    weaponHeader.className = 'shop-section-header';
    weaponHeader.textContent = 'WEAPONS';
    this.itemsEl.appendChild(weaponHeader);

    for (const [key, config] of Object.entries(WEAPONS)) {
      const owned = this.ownedWeapons.has(key);
      const canAfford = this._availablePoints >= config.cost;

      const item = document.createElement('div');
      item.className = 'shop-item' + (owned ? ' owned' : '') + (!canAfford && !owned ? ' expensive' : '');

      item.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${config.name}${owned ? ' (OWNED)' : ''}</div>
          <div class="shop-item-desc">${config.description}</div>
        </div>
        <div class="shop-item-cost">${owned ? '---' : config.cost}</div>
      `;

      if (!owned && canAfford) {
        item.addEventListener('click', () => {
          this._purchaseWeapon(key);
        });
      }

      this.itemsEl.appendChild(item);
    }

    // Upgrades section
    const upgradeHeader = document.createElement('div');
    upgradeHeader.className = 'shop-section-header';
    upgradeHeader.textContent = 'UPGRADES';
    this.itemsEl.appendChild(upgradeHeader);

    for (const [key, config] of Object.entries(UPGRADES)) {
      const level = this.levels[key];
      const maxed = level >= config.maxLevel;
      const cost = this.getCost(key);
      const canAfford = this._availablePoints >= cost;

      const item = document.createElement('div');
      item.className = 'shop-item' + (maxed ? ' maxed' : '') + (!canAfford && !maxed ? ' expensive' : '');

      item.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${config.name} ${maxed ? '(MAX)' : `Lv.${level + 1}`}</div>
          <div class="shop-item-desc">${config.description}</div>
        </div>
        <div class="shop-item-cost">${maxed ? '---' : cost}</div>
      `;

      if (!maxed && canAfford) {
        item.addEventListener('click', () => {
          this._purchase(key);
        });
      }

      this.itemsEl.appendChild(item);
    }
  }

  _purchaseWeapon(key) {
    const config = WEAPONS[key];
    if (!config || this.ownedWeapons.has(key)) return;
    if (this._availablePoints < config.cost) return;

    this._availablePoints -= config.cost;
    this.ownedWeapons.add(key);
    this.selectedWeapon = key; // auto-equip on close
    this._render();
  }

  _purchase(key) {
    const cost = this.getCost(key);
    if (this._availablePoints < cost) return;
    if (this.levels[key] >= UPGRADES[key].maxLevel) return;

    this._availablePoints -= cost;
    this.levels[key]++;
    this._render();
  }

  get spentPoints() {
    let total = 0;
    for (const [key, config] of Object.entries(UPGRADES)) {
      for (let i = 0; i < this.levels[key]; i++) {
        total += Math.round(config.baseCost * Math.pow(config.costScale, i));
      }
    }
    for (const [key, config] of Object.entries(WEAPONS)) {
      if (this.ownedWeapons.has(key)) {
        total += config.cost;
      }
    }
    return total;
  }

  get pointsRemaining() {
    return this._availablePoints;
  }
}
