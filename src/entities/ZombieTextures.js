import * as THREE from 'three';

const cache = new Map();

function lcg(seed) {
  let s = (Math.abs(seed) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const SKIN_CONFIGS = {
  walker: {
    base: [90, 122, 58],
    patches: [
      [70, 100, 50], [100, 135, 60], [55, 85, 38],
      [80, 90, 48], [65, 110, 55],
    ],
    vein: [35, 75, 25, 0.35],
    wound: [130, 30, 15],
  },
  runner: {
    base: [130, 78, 58],
    patches: [
      [105, 60, 45], [140, 88, 62], [88, 52, 38],
      [115, 72, 55], [95, 65, 50],
    ],
    vein: [80, 35, 25, 0.3],
    wound: [150, 25, 20],
  },
  tank: {
    base: [95, 60, 95],
    patches: [
      [78, 48, 82], [108, 70, 100], [62, 42, 68],
      [88, 58, 90], [72, 52, 75],
    ],
    vein: [55, 25, 55, 0.4],
    wound: [140, 20, 45],
  },
};

function genSkin(config, seed) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = lcg(seed);
  const [br, bg, bb] = config.base;

  // Base fill
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, S, S);

  // Mottled patches
  for (let i = 0; i < 55; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 8 + r() * 35);
    const pc = config.patches[i % config.patches.length];
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgba(${pc[0]},${pc[1]},${pc[2]},${0.12 + r() * 0.2})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Discoloration blotches
  for (let i = 0; i < 10; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 15 + r() * 45);
    const dark = r() > 0.5;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    if (dark) {
      g.addColorStop(0, `rgba(25,18,10,${0.08 + r() * 0.12})`);
    } else {
      g.addColorStop(0, `rgba(${br + 40},${bg + 30},${bb + 20},${0.06 + r() * 0.1})`);
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Veins
  const [vr, vg, vb, va] = config.vein;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(${vr},${vg},${vb},${va * (0.6 + r() * 0.4)})`;
    ctx.beginPath();
    let lx = r() * S, ly = r() * S;
    ctx.moveTo(lx, ly);
    const segs = 3 + (r() * 5 | 0);
    for (let j = 0; j < segs; j++) {
      lx += (r() - 0.5) * 50;
      ly += (r() - 0.5) * 50;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    // Branching
    if (r() > 0.4) {
      ctx.lineWidth = 0.7;
      ctx.lineTo(lx + (r() - 0.5) * 30, ly + (r() - 0.5) * 30);
      ctx.stroke();
      ctx.lineWidth = 1.5;
    }
  }

  // Wounds
  const [wr, wg, wb] = config.wound;
  for (let i = 0; i < 7; i++) {
    const wx = r() * S, wy = r() * S, wrad = Math.max(1, 4 + r() * 16);
    const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, wrad);
    g.addColorStop(0, `rgba(${wr},${wg},${wb},0.75)`);
    g.addColorStop(0.45, `rgba(${wr * 0.6 | 0},${wg * 0.4 | 0},${wb * 0.4 | 0},0.35)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // Deeper wound center
    if (wrad > 9) {
      const g2 = ctx.createRadialGradient(wx, wy, 0, wx, wy, Math.max(1, wrad * 0.35));
      g2.addColorStop(0, 'rgba(35,5,5,0.55)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, S, S);
    }
  }

  // Pixel noise for skin pore detail
  const id = ctx.getImageData(0, 0, S, S);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 16;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(id, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function genBump(seed) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = lcg(seed);

  // Mid-grey base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);

  // Raised bumps (skin lumps, swelling)
  for (let i = 0; i < 45; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 4 + r() * 20);
    const b = 95 + r() * 75;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgb(${b | 0},${b | 0},${b | 0})`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Vein ridges (raised lines)
  ctx.strokeStyle = 'rgba(190,190,190,0.3)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let lx = r() * S, ly = r() * S;
    ctx.moveTo(lx, ly);
    for (let j = 0; j < 4; j++) {
      lx += (r() - 0.5) * 40;
      ly += (r() - 0.5) * 40;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  // Wound depressions (dark = sunken)
  for (let i = 0; i < 6; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 3 + r() * 12);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, 'rgba(35,35,35,0.55)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Fine noise
  const id = ctx.getImageData(0, 0, S, S);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 22;
    const v = Math.max(0, Math.min(255, d[i] + n));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(id, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function genClothing(fabricColor, seed) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = lcg(seed);
  const [fr, fg, fb] = fabricColor;

  // Base fabric
  ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
  ctx.fillRect(0, 0, S, S);

  // Subtle weave lines
  ctx.strokeStyle = `rgba(${fr * 0.7 | 0},${fg * 0.7 | 0},${fb * 0.7 | 0},0.15)`;
  ctx.lineWidth = 0.5;
  for (let y = 0; y < S; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }

  // Dirt and blood stains
  for (let i = 0; i < 8; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 8 + r() * 25);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    if (r() > 0.5) {
      g.addColorStop(0, `rgba(70,12,8,${0.2 + r() * 0.3})`);
    } else {
      g.addColorStop(0, `rgba(30,25,18,${0.15 + r() * 0.25})`);
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Wear/fading
  for (let i = 0; i < 6; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 12 + r() * 30);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgba(${fr + 25},${fg + 25},${fb + 25},${0.08 + r() * 0.1})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class ZombieTextures {
  static init() {
    for (const type of ['walker', 'runner', 'tank']) {
      const cfg = SKIN_CONFIGS[type];
      for (let v = 0; v < 2; v++) {
        const base = type.charCodeAt(0) * 100 + v;
        cache.set(`${type}_${v}_skin`, genSkin(cfg, base));
        cache.set(`${type}_${v}_bump`, genBump(base + 500));
      }
    }
    cache.set('shirt_0', genClothing([50, 48, 42], 7000));
    cache.set('shirt_1', genClothing([58, 42, 38], 7100));
  }

  static getSkin(type, v) {
    return cache.get(`${type}_${v}_skin`);
  }

  static getBump(type, v) {
    return cache.get(`${type}_${v}_bump`);
  }

  static getShirt(v) {
    return cache.get(`shirt_${v}`);
  }
}
