# Zombie Shooter

A 3D first-person zombie survival game built with Three.js. Fight off endless waves of zombies, collect weapon pickups and power-ups, and upgrade your arsenal between rounds.

[Play the game](https://travislima.github.io/zombie-shooter)

## Gameplay

Survive increasingly difficult waves of zombies in a circular arena. Kill zombies to earn score, collect dropped power-ups, and spend points in the upgrade shop between waves.

### Enemy Types

| Type | Wave | HP | Speed | Damage | Points |
|------|------|----|-------|--------|--------|
| Walker | 1+ | 20 | Slow | 10 | 100 |
| Runner | 3+ | 40 | Fast | 15 | 250 |
| Tank | 5+ | 150 | Very slow | 30 | 500 |

### Weapons

Weapons drop from killed zombies. Picking one up switches your current weapon.

- **Pistol** - Default. 20-round magazine, balanced stats
- **Shotgun** - 6 pellets per shot with spread. Devastating at close range
- **SMG** - 40-round magazine, 10 rounds/sec. High volume, lower per-hit damage
- **Sniper** - 50 damage per shot, fast projectiles. 5-round magazine

### Power-ups

Killed zombies have a 30% chance to drop a power-up. Pickups float and glow on the ground, and despawn after 15 seconds.

- **Health** - Restores 30 HP
- **Speed Boost** - 1.6x movement speed for 5 seconds
- **2x Damage** - Doubles weapon damage for 8 seconds

### Upgrade Shop

After each wave, spend your score on permanent upgrades (5 levels each):

- **Damage** - +20% weapon damage per level
- **Fire Rate** - +15% fire rate per level
- **Mag Size** - +25% magazine capacity per level
- **Max Health** - +25 max HP per level
- **Shield Regen** - +2 shield regen/sec per level

## Controls

### Desktop
- **WASD** - Move
- **Mouse** - Aim
- **Left Click** - Shoot
- **Shift** - Sprint
- **R** - Reload
- **ESC** - Pause

### Mobile / Touch
Touch controls are auto-detected. A virtual joystick appears on the left for movement, a fire button on the bottom-right, a reload button above it, and swiping on the right side of the screen controls the camera.

## Getting Started

### Prerequisites

- Node.js (v14+)

### Installation

```bash
git clone https://github.com/travislima/zombie-shooter.git
cd zombie-shooter
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Building for Production

```bash
npm run build
```

Output goes to the `dist/` directory.

## Project Structure

```
zombie-shooter/
├── index.html
├── package.json
└── src/
    ├── main.js                 # Entry point
    ├── Game.js                 # Game loop and state machine
    ├── core/
    │   ├── Audio.js            # Sound effects and music
    │   ├── Input.js            # Keyboard and mouse input
    │   └── TouchControls.js    # Mobile virtual joystick and buttons
    ├── entities/
    │   ├── Player.js           # Player movement, health, shield
    │   ├── Weapon.js           # Weapon types and firing mechanics
    │   ├── Projectile.js       # Projectile pool
    │   └── Enemy.js            # Zombie types and AI
    ├── systems/
    │   ├── WaveManager.js      # Wave composition and spawning
    │   ├── Combat.js           # Hit detection, scoring, combos
    │   ├── Particles.js        # Visual effects
    │   └── Powerups.js         # Drop spawning and pickup logic
    ├── ui/
    │   ├── HUD.js              # In-game HUD
    │   ├── Screens.js          # Menu, pause, game over screens
    │   └── Shop.js             # Between-wave upgrade shop
    └── world/
        └── Arena.js            # 3D arena environment
```

## Tech Stack

- [Three.js](https://threejs.org/) - 3D rendering
- [Vite](https://vitejs.dev/) - Build tool

## License

ISC
