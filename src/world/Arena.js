import * as THREE from 'three';

const ARENA_RADIUS = 15;

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildGround();
    this._buildEdge();
    this._buildCover();
    this._buildProps();
    this._buildSkybox();
    this._buildLighting();
  }

  _buildGround() {
    // Main floor - cracked earth with procedural texture (high-res)
    const S = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Base color - dark earth
    ctx.fillStyle = '#5a4d3e';
    ctx.fillRect(0, 0, S, S);

    // Large-scale color variation
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 60 + Math.random() * 120;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const shift = Math.floor((Math.random() - 0.5) * 20);
      grad.addColorStop(0, `rgba(${80 + shift}, ${70 + shift}, ${55 + shift}, 0.15)`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);
    }

    // Add dirt variation (more detail at 1024)
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = Math.random() * 5 + 1;
      const shade = Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${75 + shade}, ${65 + shade}, ${50 + shade})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gravel/pebble detail
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 1 + Math.random() * 2;
      ctx.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${50 + Math.random() * 35 | 0},${40 + Math.random() * 25 | 0},${0.3 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add crack lines (more, thinner for detail)
    for (let i = 0; i < 35; i++) {
      ctx.strokeStyle = `rgba(58, 48, 40, ${0.3 + Math.random() * 0.4})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      let cx = Math.random() * S;
      let cy = Math.random() * S;
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 10; j++) {
        cx += (Math.random() - 0.5) * 70;
        cy += (Math.random() - 0.5) * 70;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Blood stains
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = Math.random() * 30 + 12;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(80, 15, 10, ${0.3 + Math.random() * 0.2})`);
      grad.addColorStop(0.6, `rgba(60, 10, 5, ${0.1 + Math.random() * 0.1})`);
      grad.addColorStop(1, 'rgba(60, 10, 5, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Puddle/wet patches (darker, slightly reflective looking)
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 15 + Math.random() * 40;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(30, 25, 20, 0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;

    // Generate ground normal map
    const normCanvas = document.createElement('canvas');
    normCanvas.width = normCanvas.height = 512;
    const nctx = normCanvas.getContext('2d');
    nctx.fillStyle = '#808080';
    nctx.fillRect(0, 0, 512, 512);

    // Surface bumps
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 2 + Math.random() * 8;
      const b = 110 + Math.random() * 50;
      const g = nctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgb(${b | 0},${b | 0},${b | 0})`);
      g.addColorStop(1, 'rgba(128,128,128,0)');
      nctx.fillStyle = g;
      nctx.fillRect(0, 0, 512, 512);
    }
    // Crack depressions
    for (let i = 0; i < 20; i++) {
      nctx.strokeStyle = 'rgba(50,50,50,0.5)';
      nctx.lineWidth = 1 + Math.random() * 2;
      nctx.beginPath();
      let cx = Math.random() * 512, cy = Math.random() * 512;
      nctx.moveTo(cx, cy);
      for (let j = 0; j < 6; j++) {
        cx += (Math.random() - 0.5) * 50;
        cy += (Math.random() - 0.5) * 50;
        nctx.lineTo(cx, cy);
      }
      nctx.stroke();
    }
    // Convert heightmap to normal map
    const hid = nctx.getImageData(0, 0, 512, 512);
    const hdata = hid.data;
    // Add noise
    for (let i = 0; i < hdata.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      const v = Math.max(0, Math.min(255, hdata[i] + n));
      hdata[i] = hdata[i + 1] = hdata[i + 2] = v;
    }
    nctx.putImageData(hid, 0, 0);

    const normData = nctx.getImageData(0, 0, 512, 512);
    const ndata = normData.data;
    const strength = 1.5;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const hL = hdata[(y * 512 + ((x - 1 + 512) % 512)) * 4] / 255;
        const hR = hdata[(y * 512 + ((x + 1) % 512)) * 4] / 255;
        const hU = hdata[(((y - 1 + 512) % 512) * 512 + x) * 4] / 255;
        const hD = hdata[(((y + 1) % 512) * 512 + x) * 4] / 255;
        const dx = (hL - hR) * strength;
        const dy = (hU - hD) * strength;
        const dz = 1.0;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        ndata[idx] = ((dx / len) * 0.5 + 0.5) * 255 | 0;
        ndata[idx + 1] = ((dy / len) * 0.5 + 0.5) * 255 | 0;
        ndata[idx + 2] = ((dz / len) * 0.5 + 0.5) * 255 | 0;
        ndata[idx + 3] = 255;
      }
    }
    nctx.putImageData(normData, 0, 0);

    const normalMap = new THREE.CanvasTexture(normCanvas);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(4, 4);

    const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: texture,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      metalness: 0.15,
      roughness: 0.82,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Radial worn rings
    for (let r = 5; r <= ARENA_RADIUS; r += 5) {
      const ringGeo = new THREE.RingGeometry(r - 0.03, r + 0.03, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3a3028,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      this.group.add(ring);
    }
  }

  _buildEdge() {
    // Chain-link fence posts around perimeter
    const postCount = 24;
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x6a5a4a,
      metalness: 0.6,
      roughness: 0.4,
    });
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6);

    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      const x = Math.cos(angle) * ARENA_RADIUS;
      const z = Math.sin(angle) * ARENA_RADIUS;

      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 1.25, z);
      post.castShadow = true;
      this.group.add(post);
    }

    // Wire between posts (top)
    const wireGeo = new THREE.TorusGeometry(ARENA_RADIUS, 0.015, 4, 128);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x888877,
      transparent: true,
      opacity: 0.6,
    });
    const wireTop = new THREE.Mesh(wireGeo, wireMat);
    wireTop.rotation.x = Math.PI / 2;
    wireTop.position.y = 2.4;
    this.group.add(wireTop);

    const wireMid = wireTop.clone();
    wireMid.position.y = 1.5;
    this.group.add(wireMid);

    // Vertical boundary (invisible wall, subtle)
    const wallGeo = new THREE.CylinderGeometry(ARENA_RADIUS + 0.1, ARENA_RADIUS + 0.1, 3, 64, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x666655,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 1.5;
    this.group.add(wall);
  }

  _buildCover() {
    // Barricades and debris scattered around
    const coverPositions = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const r = 7 + (i % 2) * 3.5;
      coverPositions.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        rotY: angle + Math.PI / 2,
      });
    }

    coverPositions.forEach((pos, i) => {
      let geo;
      let mat;

      if (i % 4 === 0) {
        // Broken concrete pillar
        geo = new THREE.CylinderGeometry(0.35, 0.5, 2.2, 6);
        mat = new THREE.MeshStandardMaterial({
          color: 0x8a8078, metalness: 0.1, roughness: 0.95,
          emissive: 0x0a0805, emissiveIntensity: 0.1,
        });
      } else if (i % 4 === 1) {
        // Wooden barricade
        geo = new THREE.BoxGeometry(2.2, 1.3, 0.3);
        mat = new THREE.MeshStandardMaterial({
          color: 0x6a5030, metalness: 0.05, roughness: 0.95,
          emissive: 0x1a1008, emissiveIntensity: 0.1,
        });
      } else if (i % 4 === 2) {
        // Overturned car (simplified)
        geo = new THREE.BoxGeometry(1.8, 1.0, 1.2);
        mat = new THREE.MeshStandardMaterial({
          color: 0x4a4a50, metalness: 0.4, roughness: 0.6,
          emissive: 0x050508, emissiveIntensity: 0.1,
        });
      } else {
        // Supply crate
        geo = new THREE.BoxGeometry(1, 1, 1);
        mat = new THREE.MeshStandardMaterial({
          color: 0x5a6a3a, metalness: 0.1, roughness: 0.85,
          emissive: 0x0a1005, emissiveIntensity: 0.1,
        });
      }

      const cover = new THREE.Mesh(geo, mat);
      const h = geo.parameters?.height || geo.parameters?.radiusTop ? 1.1 : 0.5;
      cover.position.set(pos.x, h / 2, pos.z);
      cover.rotation.y = pos.rotY;
      if (i % 4 === 2) cover.rotation.z = 0.15; // slightly tilted car
      cover.castShadow = true;
      cover.receiveShadow = true;

      // Edge highlight
      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x3a3028, transparent: true, opacity: 0.25 });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      cover.add(edges);

      this.group.add(cover);
    });
  }

  _buildProps() {
    // Scattered small debris
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0x5a4d3e, roughness: 0.9, metalness: 0.1,
    });

    // Small rocks
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (ARENA_RADIUS - 1);
      const size = 0.05 + Math.random() * 0.15;
      const geo = new THREE.DodecahedronGeometry(size, 0);
      const rock = new THREE.Mesh(geo, debrisMat);
      rock.position.set(
        Math.cos(angle) * r,
        size * 0.4,
        Math.sin(angle) * r,
      );
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.group.add(rock);
    }

    // Oil barrels (a few scattered)
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a, metalness: 0.5, roughness: 0.5,
    });
    const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);

    const barrelPositions = [
      { x: -5, z: -8, ry: 0, tipped: false },
      { x: 9, z: 3, ry: 1, tipped: true },
      { x: -3, z: 10, ry: 0.5, tipped: false },
    ];

    barrelPositions.forEach(bp => {
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      if (bp.tipped) {
        barrel.position.set(bp.x, 0.3, bp.z);
        barrel.rotation.z = Math.PI / 2;
      } else {
        barrel.position.set(bp.x, 0.4, bp.z);
      }
      barrel.rotation.y = bp.ry;
      barrel.castShadow = true;

      // Rusty stripe
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0x8a4020, metalness: 0.3, roughness: 0.7,
      });
      const stripeGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.1, 8);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.15;
      barrel.add(stripe);

      this.group.add(barrel);
    });
  }

  _buildSkybox() {
    // Dark, ominous sky with clouds and moon
    const skyGeo = new THREE.SphereGeometry(200, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vWorldPos;

        // Simple noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;

          // Base sky gradient
          vec3 ground = vec3(0.18, 0.14, 0.11);
          vec3 horizon = vec3(0.35, 0.2, 0.15);
          vec3 sky = vec3(0.08, 0.07, 0.12);
          vec3 zenith = vec3(0.04, 0.03, 0.08);

          vec3 col = mix(ground, horizon, smoothstep(-0.1, 0.02, h));
          col = mix(col, sky, smoothstep(0.02, 0.3, h));
          col = mix(col, zenith, smoothstep(0.3, 0.8, h));

          // Reddish glow near horizon
          col += vec3(0.12, 0.03, 0.0) * (1.0 - smoothstep(0.0, 0.12, abs(h)));

          // Moon
          vec3 moonDir = normalize(vec3(0.4, 0.6, -0.5));
          float moonDot = dot(dir, moonDir);
          float moonDisc = smoothstep(0.997, 0.9985, moonDot);
          float moonGlow = smoothstep(0.97, 0.999, moonDot) * 0.15;
          col += vec3(0.9, 0.85, 0.75) * moonDisc;
          col += vec3(0.3, 0.25, 0.2) * moonGlow;

          // Clouds (only above horizon)
          if (h > 0.0) {
            vec2 cloudUV = dir.xz / (h + 0.1) * 2.0;
            cloudUV += time * 0.005;
            float clouds = fbm(cloudUV * 1.5);
            clouds = smoothstep(0.35, 0.7, clouds);
            float cloudFade = smoothstep(0.0, 0.15, h) * smoothstep(0.8, 0.3, h);
            vec3 cloudColor = mix(vec3(0.15, 0.1, 0.08), vec3(0.25, 0.18, 0.14), clouds);
            col = mix(col, cloudColor, clouds * 0.5 * cloudFade);
          }

          // Stars (only high in sky, dim)
          if (h > 0.2) {
            float starField = hash(floor(dir.xz * 500.0));
            float starBright = step(0.997, starField) * smoothstep(0.2, 0.5, h);
            col += vec3(0.7, 0.7, 0.8) * starBright * 0.4;
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.skyMat = skyMat;
    this.scene.add(this.sky);

    // Darker fog for atmosphere
    this.scene.fog = new THREE.FogExp2(0x2a2018, 0.02);
  }

  _buildLighting() {
    // Hemisphere light for natural sky/ground ambient
    const hemiLight = new THREE.HemisphereLight(0x556677, 0x3a2a1a, 0.6);
    this.scene.add(hemiLight);

    // Subtle warm ambient fill
    const ambient = new THREE.AmbientLight(0x998877, 0.25);
    this.scene.add(ambient);

    // Main directional light (low moon, warm/orange) — 4K shadows
    const dirLight = new THREE.DirectionalLight(0xeeddcc, 1.0);
    dirLight.position.set(8, 15, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -18;
    dirLight.shadow.camera.right = 18;
    dirLight.shadow.camera.top = 18;
    dirLight.shadow.camera.bottom = -18;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);

    // Cool fill from opposite side (moonlight bounce)
    const fillLight = new THREE.DirectionalLight(0x556688, 0.25);
    fillLight.position.set(-8, 8, -5);
    this.scene.add(fillLight);

    // Rim light from behind (dramatic backlight silhouette)
    const rimLight = new THREE.DirectionalLight(0x443355, 0.35);
    rimLight.position.set(-5, 10, -10);
    this.scene.add(rimLight);

    // Ground-level point lights for atmosphere (flickering fire barrels)
    const firePositions = [
      { x: -5, z: -8 },
      { x: -3, z: 10 },
    ];

    this.fireLights = [];
    firePositions.forEach(fp => {
      const light = new THREE.PointLight(0xff6622, 0.8, 10);
      light.position.set(fp.x, 1.2, fp.z);
      light.castShadow = true;
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      light.shadow.bias = -0.002;
      this.group.add(light);
      this.fireLights.push(light);

      // Fire glow sprite
      const spriteMat = new THREE.SpriteMaterial({
        color: 0xff8833,
        transparent: true,
        opacity: 0.35,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(fp.x, 0.9, fp.z);
      sprite.scale.set(0.8, 1.2, 1);
      this.group.add(sprite);
    });
  }

  update(dt) {
    // Animate sky clouds
    if (this.skyMat) {
      this.skyMat.uniforms.time.value += dt;
    }

    // Flicker fire lights
    if (this.fireLights) {
      for (const light of this.fireLights) {
        light.intensity = 0.5 + Math.random() * 0.3;
      }
    }
  }
}
