// Rendering pipeline: scene -> bloom -> filmic tone mapping -> vignette + grain,
// then crisp map labels (no tone mapping, exact neutral colours). Scene changes dissolve between two such frames.
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

// Scene-to-scene dissolve: the outgoing frame pushes in gently while the incoming frame blooms in
// from the centre through soft, cloud-shaped openings. Nothing opaque covers the frame.
const DissolveShader = {
  uniforms: { tA: { value: null }, tB: { value: null }, uP: { value: 0 }, uZoomA: { value: 1 }, uAspect: { value: 1080 / 1920 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tA, tB; uniform float uP, uZoomA, uAspect, uTime; varying vec2 vUv;
    ${NOISE_GLSL}
    void main() {
      vec3 a = texture2D(tA, (vUv - 0.5) / uZoomA + 0.5).rgb;
      vec3 b = texture2D(tB, vUv).rgb;
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float n = fbm(q * 2.3 + vec2(0.0, uTime * 0.25) + 5.0);
      float radial = length(q * vec2(1.0, 0.75)) * 1.4;
      float v = 0.55 * radial + 0.45 * n;
      // v spans ~0.1-0.7: the reveal travels across that whole range at an even pace, each pixel fading softly
      float m = smoothstep(v - 0.2, v + 0.2, mix(-0.1, 0.92, uP));
      gl_FragColor = vec4(mix(a, b, m), 1.0);
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

    // Two full-resolution snapshots of the canvas for scene-to-scene dissolves
    this.texA = new THREE.FramebufferTexture(width * dpr, height * dpr);
    this.texB = new THREE.FramebufferTexture(width * dpr, height * dpr);
    for (const t of [this.texA, this.texB]) { t.minFilter = t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.NoColorSpace; }
    this.blendScene = new THREE.Scene();
    this.blendMat = new THREE.ShaderMaterial({ ...DissolveShader, uniforms: THREE.UniformsUtils.clone(DissolveShader.uniforms), depthTest: false, depthWrite: false });
    this.blendMat.uniforms.tA.value = this.texA;
    this.blendMat.uniforms.tB.value = this.texB;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blendMat);
    quad.frustumCulled = false;
    this.blendScene.add(quad);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene, o.labels
   * @param {THREE.Camera} o.camera
   * @param {number} o.frame
   */
  render({ scene, camera, labels, frame, bloom = 0.25, exposure = 1.0, vignette = 0.25 }) {
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
    r.autoClear = true;
    r.toneMapping = THREE.ACESFilmicToneMapping;
  }

  /** Dissolve from frame A to frame B (p = 0..1); A keeps pushing in by `zoomA`. */
  blend(outA, outB, { frame, p, zoomA = 1 }) {
    const r = this.renderer;
    this.render({ ...outA, frame });
    r.copyFramebufferToTexture(this.texA);
    this.render({ ...outB, frame });
    r.copyFramebufferToTexture(this.texB);
    const u = this.blendMat.uniforms;
    u.uP.value = p;
    u.uZoomA.value = zoomA;
    u.uTime.value = frame / 30;
    r.toneMapping = THREE.NoToneMapping;
    r.render(this.blendScene, this.orthoCam);
    r.toneMapping = THREE.ACESFilmicToneMapping;
  }
}
