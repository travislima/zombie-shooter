import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

// Enhanced vignette + color grading + film grain + chromatic aberration shader
const PostFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignetteIntensity: { value: 0.45 },
    vignetteRoundness: { value: 0.5 },
    grainIntensity: { value: 0.05 },
    saturation: { value: 1.15 },
    contrast: { value: 1.1 },
    tintColor: { value: new THREE.Vector3(1.0, 0.95, 0.88) },
    chromaticStrength: { value: 0.003 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignetteIntensity;
    uniform float vignetteRoundness;
    uniform float grainIntensity;
    uniform float saturation;
    uniform float contrast;
    uniform vec3 tintColor;
    uniform float chromaticStrength;
    uniform vec2 resolution;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // Chromatic aberration - radial from center
      vec2 fromCenter = uv - 0.5;
      float dist = length(fromCenter);
      float chromaOffset = chromaticStrength * dist * dist;
      vec2 dir = normalize(fromCenter + 0.0001);

      float r = texture2D(tDiffuse, uv + dir * chromaOffset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * chromaOffset).b;
      float a = texture2D(tDiffuse, uv).a;
      vec4 color = vec4(r, g, b, a);

      // Color tint (warm apocalyptic)
      color.rgb *= tintColor;

      // Saturation
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);

      // Contrast with toe/shoulder curve (filmic)
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;

      // Lift shadows slightly for cinematic look
      color.rgb = max(color.rgb, vec3(0.01, 0.008, 0.015));

      // Vignette
      vec2 vigUv = vUv * 2.0 - 1.0;
      vigUv.x *= vignetteRoundness;
      float vig = 1.0 - dot(vigUv, vigUv) * vignetteIntensity;
      vig = clamp(vig, 0.0, 1.0);
      vig = smoothstep(0.0, 1.0, vig);
      color.rgb *= vig;

      // Film grain (subtle, time-varying)
      float grain = rand(vUv * fract(time)) * grainIntensity;
      color.rgb += grain - grainIntensity * 0.5;

      // Slight color banding reduction via dithering
      color.rgb += (rand(vUv + fract(time * 0.1)) - 0.5) / 255.0;

      color.rgb = clamp(color.rgb, 0.0, 1.0);
      gl_FragColor = color;
    }
  `,
};

export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();

    this.composer = new EffectComposer(renderer);

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // GTAO (Ground Truth Ambient Occlusion) — high-quality SSAO
    this.gtaoPass = new GTAOPass(scene, camera, size.x, size.y);
    this.gtaoPass.output = GTAOPass.OUTPUT.Denoise;
    this.gtaoPass.blendIntensity = 1.0;
    // GTAO tuning for close-quarters zombie game
    this.gtaoPass.gtaoMaterial.uniforms.radius.value = 0.5;
    this.gtaoPass.gtaoMaterial.uniforms.distanceExponent.value = 2.0;
    this.gtaoPass.gtaoMaterial.uniforms.thickness.value = 2.0;
    this.gtaoPass.gtaoMaterial.uniforms.scale.value = 1.5;
    this.composer.addPass(this.gtaoPass);

    // Bloom — tuned for ACES filmic (brighter threshold since tone mapping compresses)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.55,  // strength (slightly stronger for cinematic glow)
      0.5,   // radius
      0.7,   // threshold (lower to catch more bright spots)
    );
    this.composer.addPass(this.bloomPass);

    // Custom post-FX (vignette, color grading, chromatic aberration, film grain)
    this.postFXPass = new ShaderPass(PostFXShader);
    this.postFXPass.uniforms.resolution.value.set(size.x, size.y);
    this.composer.addPass(this.postFXPass);

    // SMAA (higher quality than FXAA)
    this.smaaPass = new SMAAPass(size.x * pixelRatio, size.y * pixelRatio);
    this.composer.addPass(this.smaaPass);

    // Output pass (tone mapping + color space)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  resize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio();
    this.composer.setSize(width, height);
    this.smaaPass.setSize(width * pixelRatio, height * pixelRatio);
    this.gtaoPass.setSize(width, height);
    this.postFXPass.uniforms.resolution.value.set(width, height);
  }

  render(dt) {
    this.postFXPass.uniforms.time.value += dt;
    this.composer.render(dt);
  }
}
