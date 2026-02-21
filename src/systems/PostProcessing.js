import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// Custom vignette + color grading + film grain shader
const PostFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignetteIntensity: { value: 0.4 },
    vignetteRoundness: { value: 0.5 },
    grainIntensity: { value: 0.06 },
    saturation: { value: 1.1 },
    contrast: { value: 1.08 },
    tintColor: { value: new THREE.Vector3(1.0, 0.95, 0.88) },
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
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Color tint (warm apocalyptic)
      color.rgb *= tintColor;

      // Saturation
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);

      // Contrast
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;

      // Vignette
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= vignetteRoundness;
      float vig = 1.0 - dot(uv, uv) * vignetteIntensity;
      vig = clamp(vig, 0.0, 1.0);
      vig = smoothstep(0.0, 1.0, vig);
      color.rgb *= vig;

      // Film grain
      float grain = rand(vUv * time) * grainIntensity;
      color.rgb += grain - grainIntensity * 0.5;

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

    this.composer = new EffectComposer(renderer);

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom - subtle glow on bright elements (eyes, muzzle flash, powerups)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.4,  // strength
      0.6,  // radius
      0.85, // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Custom post-FX (vignette, color grading, film grain)
    this.postFXPass = new ShaderPass(PostFXShader);
    this.composer.addPass(this.postFXPass);

    // FXAA
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
    this.composer.addPass(this.fxaaPass);

    // Output pass (tone mapping + color space)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.fxaaPass.uniforms.resolution.value.set(1 / width, 1 / height);
  }

  render(dt) {
    this.postFXPass.uniforms.time.value += dt;
    this.composer.render(dt);
  }
}
