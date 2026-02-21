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
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = lcg(seed);
  const [br, bg, bb] = config.base;

  // Base fill
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, S, S);

  // Large-scale skin variation (subsurface color bleed)
  for (let i = 0; i < 15; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 40 + r() * 80);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    const shift = (r() - 0.5) * 20;
    g.addColorStop(0, `rgba(${br + shift | 0},${bg + shift * 0.7 | 0},${bb + shift * 0.5 | 0},${0.08 + r() * 0.12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Mottled patches (more at higher res)
  for (let i = 0; i < 80; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 6 + r() * 45);
    const pc = config.patches[i % config.patches.length];
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgba(${pc[0]},${pc[1]},${pc[2]},${0.1 + r() * 0.2})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Discoloration blotches
  for (let i = 0; i < 14; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 20 + r() * 60);
    const dark = r() > 0.5;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    if (dark) {
      g.addColorStop(0, `rgba(25,18,10,${0.08 + r() * 0.15})`);
    } else {
      g.addColorStop(0, `rgba(${br + 40},${bg + 30},${bb + 20},${0.06 + r() * 0.12})`);
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Veins (more detail at higher res)
  const [vr, vg, vb, va] = config.vein;
  for (let i = 0; i < 20; i++) {
    ctx.lineWidth = 0.8 + r() * 1.5;
    ctx.strokeStyle = `rgba(${vr},${vg},${vb},${va * (0.5 + r() * 0.5)})`;
    ctx.beginPath();
    let lx = r() * S, ly = r() * S;
    ctx.moveTo(lx, ly);
    const segs = 3 + (r() * 7 | 0);
    for (let j = 0; j < segs; j++) {
      lx += (r() - 0.5) * 60;
      ly += (r() - 0.5) * 60;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    // Branching veins
    if (r() > 0.35) {
      ctx.lineWidth = 0.4 + r() * 0.6;
      const branches = 1 + (r() * 2 | 0);
      for (let b = 0; b < branches; b++) {
        ctx.lineTo(lx + (r() - 0.5) * 40, ly + (r() - 0.5) * 40);
        ctx.stroke();
      }
    }
  }

  // Wounds
  const [wr, wg, wb] = config.wound;
  for (let i = 0; i < 10; i++) {
    const wx = r() * S, wy = r() * S, wrad = Math.max(1, 5 + r() * 22);
    const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, wrad);
    g.addColorStop(0, `rgba(${wr},${wg},${wb},0.75)`);
    g.addColorStop(0.35, `rgba(${wr * 0.7 | 0},${wg * 0.4 | 0},${wb * 0.4 | 0},0.45)`);
    g.addColorStop(0.7, `rgba(${wr * 0.4 | 0},${wg * 0.2 | 0},${wb * 0.2 | 0},0.15)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // Deeper wound center
    if (wrad > 8) {
      const g2 = ctx.createRadialGradient(wx, wy, 0, wx, wy, Math.max(1, wrad * 0.35));
      g2.addColorStop(0, 'rgba(35,5,5,0.6)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, S, S);
    }
  }

  // Pore/skin texture detail - fine speckle
  for (let i = 0; i < 300; i++) {
    const sx = r() * S, sy = r() * S, sr = 1 + r() * 3;
    const dark = r() > 0.5;
    ctx.fillStyle = dark
      ? `rgba(0,0,0,${0.03 + r() * 0.06})`
      : `rgba(255,255,255,${0.02 + r() * 0.04})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pixel noise for skin pore detail
  const id = ctx.getImageData(0, 0, S, S);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(id, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function genNormal(seed) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = lcg(seed);

  // Start with flat normal (128, 128, 255)
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, S, S);

  // Generate a heightmap first, then convert to normals
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = heightCanvas.height = S;
  const hctx = heightCanvas.getContext('2d');

  // Mid-grey base
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, S, S);

  // Raised bumps (skin lumps, swelling)
  for (let i = 0; i < 55; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 4 + r() * 25);
    const b = 100 + r() * 80;
    const g = hctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgb(${b | 0},${b | 0},${b | 0})`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    hctx.fillStyle = g;
    hctx.fillRect(0, 0, S, S);
  }

  // Vein ridges (raised lines)
  hctx.strokeStyle = 'rgba(195,195,195,0.35)';
  hctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    hctx.beginPath();
    let lx = r() * S, ly = r() * S;
    hctx.moveTo(lx, ly);
    for (let j = 0; j < 5; j++) {
      lx += (r() - 0.5) * 45;
      ly += (r() - 0.5) * 45;
      hctx.lineTo(lx, ly);
    }
    hctx.stroke();
  }

  // Wound depressions (dark = sunken)
  for (let i = 0; i < 8; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 3 + r() * 15);
    const g = hctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, 'rgba(30,30,30,0.6)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    hctx.fillStyle = g;
    hctx.fillRect(0, 0, S, S);
  }

  // Fine surface noise
  const hid = hctx.getImageData(0, 0, S, S);
  const hd = hid.data;
  for (let i = 0; i < hd.length; i += 4) {
    const n = (r() - 0.5) * 24;
    const v = Math.max(0, Math.min(255, hd[i] + n));
    hd[i] = hd[i + 1] = hd[i + 2] = v;
  }
  hctx.putImageData(hid, 0, 0);

  // Read height data and compute normals via Sobel
  const heightData = hctx.getImageData(0, 0, S, S).data;
  const normalData = ctx.getImageData(0, 0, S, S);
  const nd = normalData.data;
  const strength = 2.0;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;

      // Sample neighbors (wrap around for tiling)
      const xL = ((x - 1 + S) % S);
      const xR = ((x + 1) % S);
      const yU = ((y - 1 + S) % S);
      const yD = ((y + 1) % S);

      const hL = heightData[(y * S + xL) * 4] / 255;
      const hR = heightData[(y * S + xR) * 4] / 255;
      const hU = heightData[(yU * S + x) * 4] / 255;
      const hD = heightData[(yD * S + x) * 4] / 255;

      // Compute normal from height differences
      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Map to [0, 255] range (tangent-space normal map)
      nd[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }

  ctx.putImageData(normalData, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function genClothing(fabricColor, seed) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = lcg(seed);
  const [fr, fg, fb] = fabricColor;

  // Base fabric
  ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
  ctx.fillRect(0, 0, S, S);

  // Fabric weave pattern (horizontal + vertical)
  ctx.lineWidth = 0.5;
  for (let y = 0; y < S; y += 3) {
    ctx.strokeStyle = `rgba(${fr * 0.7 | 0},${fg * 0.7 | 0},${fb * 0.7 | 0},${0.1 + r() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }
  for (let x = 0; x < S; x += 5) {
    ctx.strokeStyle = `rgba(${fr * 0.75 | 0},${fg * 0.75 | 0},${fb * 0.75 | 0},${0.05 + r() * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S);
    ctx.stroke();
  }

  // Dirt and blood stains
  for (let i = 0; i < 12; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 8 + r() * 35);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    if (r() > 0.5) {
      g.addColorStop(0, `rgba(70,12,8,${0.2 + r() * 0.35})`);
    } else {
      g.addColorStop(0, `rgba(30,25,18,${0.15 + r() * 0.3})`);
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Wear/fading
  for (let i = 0; i < 8; i++) {
    const px = r() * S, py = r() * S, pr = Math.max(1, 15 + r() * 40);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgba(${fr + 25},${fg + 25},${fb + 25},${0.08 + r() * 0.12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // Fine noise
  const id = ctx.getImageData(0, 0, S, S);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 12;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(id, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ZombieTextures {
  static init() {
    for (const type of ['walker', 'runner', 'tank']) {
      const cfg = SKIN_CONFIGS[type];
      for (let v = 0; v < 2; v++) {
        const base = type.charCodeAt(0) * 100 + v;
        cache.set(`${type}_${v}_skin`, genSkin(cfg, base));
        cache.set(`${type}_${v}_normal`, genNormal(base + 500));
      }
    }
    cache.set('shirt_0', genClothing([50, 48, 42], 7000));
    cache.set('shirt_1', genClothing([58, 42, 38], 7100));
  }

  static getSkin(type, v) {
    return cache.get(`${type}_${v}_skin`);
  }

  static getNormal(type, v) {
    return cache.get(`${type}_${v}_normal`);
  }

  static getShirt(v) {
    return cache.get(`shirt_${v}`);
  }
}
