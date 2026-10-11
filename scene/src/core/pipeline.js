// Rendering pipeline: scene -> bloom -> filmic tone mapping -> vignette + grain,
// then crisp map labels (no tone mapping, exact neutral colours), then the cloud-bank wipe.
// The canvas is rendered at 2x pixel density; the browser scales it down 2:1 (a 2x2 box filter).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 }, uVignette: { value: 0.25 }, uGrain: { value: 0.05 }, uDpr: { value: 2 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uFrame, uVignette, uGrain, uDpr; varying vec2 vUv;
    ${NOISE_GLSL}
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float d = length((vUv - 0.5) * vec2(1.0, 0.82)) * 1.42;
      c *= 1.0 - uVignette * smoothstep(0.42, 1.08, d);
      // Fine grain, one value per output pixel (2x2 render pixels), re-seeded every frame.
      vec2 p = floor(gl_FragCoord.xy / uDpr);
      float n = hash12(p + vec2(mod(uFrame * 37.0, 911.0), mod(uFrame * 71.0, 577.0))) - 0.5;
      c += n * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

const WipeShader = {
  uniforms: { uCover: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1080 / 1920 }, uDir: { value: new THREE.Vector2(0, 1) } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uCover, uTime, uAspect; uniform vec2 uDir; varying vec2 vUv;
    ${NOISE_GLSL}
    void main() {
      if (uCover <= 0.0) discard;
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      // Two cloud layers rushing past at different speeds give the feeling of flying through.
      float a = fbm(p * 2.4 + uDir * uTime * 1.6 + 3.0);
      float b = fbm(p * 4.3 + uDir * uTime * 2.7 + 11.0);
      float dens = 0.62 * a + 0.38 * b;
      float th = mix(1.05, -0.25, uCover);
      float alpha = smoothstep(th - 0.10, th + 0.10, dens);
      // Soft top-left light on the cloud bank (storm grey family, sRGB)
      float lit = clamp(0.5 + (fbm(p * 2.4 + uDir * uTime * 1.6 + 3.0 + vec2(-0.04, 0.05)) - a) * 9.0, 0.0, 1.0);
      vec3 dark = vec3(0.30, 0.34, 0.39), light = vec3(0.70, 0.74, 0.78);
      vec3 col = mix(dark, light, 0.35 + 0.65 * lit * smoothstep(0.2, 0.9, dens));
      gl_FragColor = vec4(col, alpha);
    }`,
};

export class Pipeline {
  constructor(canvas, { width = 1080, height = 1920, dpr = 2 } = {}) {
    this.width = width; this.height = height; this.dpr = dpr;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(dpr);
    r.setSize(width, height, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap; // filtered with shadow.radius; cheaper than PCFSoft in software

    const rt = new THREE.WebGLRenderTarget(width * dpr, height * dpr, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(r, rt);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.25, 0.55, 1.6); // only the brightest highlights glow
    this.finish = new ShaderPass(FinishShader);
    this.finish.uniforms.uDpr.value = dpr;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.finish);
    // Bloom only needs a blurry glow: run it at quarter resolution (same look, ~4x cheaper).
    this.bloom.setSize(width / 2, height / 2);

    this.wipeScene = new THREE.Scene();
    this.wipeMat = new THREE.ShaderMaterial({ ...WipeShader, uniforms: THREE.UniformsUtils.clone(WipeShader.uniforms), transparent: true, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.wipeMat);
    quad.frustumCulled = false;
    this.wipeScene.add(quad);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene, o.labels
   * @param {THREE.Camera} o.camera
   * @param {number} o.frame
   * @param {number} o.cover  cloud wipe coverage 0..1
   */
  render({ scene, camera, labels, frame, cover = 0, wipeTime = 0, bloom = 0.25, exposure = 1.0, vignette = 0.25 }) {
    const r = this.renderer;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.bloom.strength = bloom;
    this.finish.uniforms.uFrame.value = frame;
    this.finish.uniforms.uVignette.value = vignette;
    r.toneMappingExposure = exposure;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.autoClear = true;
    this.composer.render();
    r.autoClear = false;
    r.toneMapping = THREE.NoToneMapping;
    if (labels) r.render(labels, camera);
    if (cover > 0) {
      this.wipeMat.uniforms.uCover.value = cover;
      this.wipeMat.uniforms.uTime.value = wipeTime;
      r.render(this.wipeScene, this.orthoCam);
    }
    r.autoClear = true;
    r.toneMapping = THREE.ACESFilmicToneMapping;
  }
}
