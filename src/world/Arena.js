import * as THREE from 'three';

const ARENA_RADIUS = 15;
const PLATFORM_HEIGHT = 0.2;

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildPlatform();
    this._buildEdge();
    this._buildCover();
    this._buildSkybox();
    this._buildLighting();
  }

  _buildPlatform() {
    // Main floor - dusty cracked ground
    const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x8b7d6b,
      metalness: 0.1,
      roughness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Grid lines - faint cracks
    const gridGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x6b5e50,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.01;
    this.group.add(grid);

    // Radial grid - worn rings in the ground
    for (let r = 5; r <= ARENA_RADIUS; r += 5) {
      const ringGeo = new THREE.RingGeometry(r - 0.02, r + 0.02, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x6b5e50,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.group.add(ring);
    }
  }

  _buildEdge() {
    // Rusty perimeter fence ring
    const edgeGeo = new THREE.TorusGeometry(ARENA_RADIUS, 0.08, 8, 128);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x8b4513,
      transparent: true,
      opacity: 0.7,
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.05;
    this.group.add(edge);

    // Outer glow - faint warning
    const glowGeo = new THREE.TorusGeometry(ARENA_RADIUS, 0.3, 8, 128);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x8b4513,
      transparent: true,
      opacity: 0.08,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = 0.05;
    this.group.add(glow);

    // Vertical boundary (subtle)
    const wallGeo = new THREE.CylinderGeometry(ARENA_RADIUS + 0.1, ARENA_RADIUS + 0.1, 3, 64, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x666655,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 1.5;
    this.group.add(wall);
  }

  _buildCover() {
    // 8 cover positions around the arena - barricades and debris
    const coverPositions = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 8 + (i % 2) * 3;
      coverPositions.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        rotY: angle + Math.PI / 2,
      });
    }

    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x7a6a5a,
      metalness: 0.2,
      roughness: 0.8,
      emissive: 0x1a1510,
      emissiveIntensity: 0.1,
    });

    coverPositions.forEach((pos, i) => {
      let geo;
      if (i % 3 === 0) {
        // Tall pillar - broken concrete
        geo = new THREE.CylinderGeometry(0.4, 0.5, 2, 6);
      } else if (i % 3 === 1) {
        // Low wall - wooden barricade
        geo = new THREE.BoxGeometry(2, 1.2, 0.4);
      } else {
        // Crate - supply crate
        geo = new THREE.BoxGeometry(1, 1, 1);
      }

      const cover = new THREE.Mesh(geo, coverMat.clone());
      cover.position.set(pos.x, geo.parameters?.height ? geo.parameters.height / 2 : 0.6, pos.z);
      cover.rotation.y = pos.rotY;
      cover.castShadow = true;
      cover.receiveShadow = true;

      // Edge accent
      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x5a4a3a, transparent: true, opacity: 0.3 });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      cover.add(edges);

      this.group.add(cover);
    });
  }

  _buildSkybox() {
    // Overcast foggy sky
    const skyGeo = new THREE.SphereGeometry(200, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 bottom = vec3(0.45, 0.42, 0.38);
          vec3 top = vec3(0.6, 0.58, 0.55);
          vec3 col = mix(bottom, top, smoothstep(-0.2, 0.5, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  _buildLighting() {
    // Ambient - warm overcast light
    const ambient = new THREE.AmbientLight(0xccbbaa, 0.6);
    this.scene.add(ambient);

    // Main directional light (hazy sunlight)
    const dirLight = new THREE.DirectionalLight(0xffe8cc, 0.8);
    dirLight.position.set(10, 20, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);

    // Fill light from below - subtle warm bounce
    const rimLight = new THREE.DirectionalLight(0x887766, 0.15);
    rimLight.position.set(0, -5, 0);
    this.scene.add(rimLight);

    // Center area light
    const centerLight = new THREE.PointLight(0xddccaa, 0.3, 20);
    centerLight.position.set(0, 0.1, 0);
    this.group.add(centerLight);
  }

  update(dt) {
    // Could animate effects here
  }
}
