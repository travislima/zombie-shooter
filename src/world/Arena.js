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
    // Main floor - cracked earth with procedural texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base color - dark earth
    ctx.fillStyle = '#5a4d3e';
    ctx.fillRect(0, 0, 512, 512);

    // Add dirt variation
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 4 + 1;
      const shade = Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${75 + shade}, ${65 + shade}, ${50 + shade})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add crack lines
    ctx.strokeStyle = '#3a3028';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      let cx = Math.random() * 512;
      let cy = Math.random() * 512;
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 8; j++) {
        cx += (Math.random() - 0.5) * 60;
        cy += (Math.random() - 0.5) * 60;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Blood stains
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 20 + 10;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(80, 15, 10, 0.4)');
      grad.addColorStop(1, 'rgba(60, 10, 5, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);

    const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.05,
      roughness: 0.95,
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
    // Ambient - tuned for NoToneMapping + post-processing pipeline
    const ambient = new THREE.AmbientLight(0x998877, 0.5);
    this.scene.add(ambient);

    // Main directional light (low sun, warm/orange)
    const dirLight = new THREE.DirectionalLight(0xeeddcc, 0.7);
    dirLight.position.set(8, 15, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Subtle cool fill from opposite side
    const fillLight = new THREE.DirectionalLight(0x556688, 0.15);
    fillLight.position.set(-8, 8, -5);
    this.scene.add(fillLight);

    // Ground-level point lights for atmosphere (flickering fire barrels)
    const firePositions = [
      { x: -5, z: -8 },
      { x: -3, z: 10 },
    ];

    this.fireLights = [];
    firePositions.forEach(fp => {
      const light = new THREE.PointLight(0xff6622, 0.6, 8);
      light.position.set(fp.x, 1.2, fp.z);
      this.group.add(light);
      this.fireLights.push(light);

      // Fire glow sprite
      const spriteMat = new THREE.SpriteMaterial({
        color: 0xff8833,
        transparent: true,
        opacity: 0.3,
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
