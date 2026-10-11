// Finishing: ACES tone mapping (OutputPass), gentle bloom, SMAA, then vignette + fine film grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GrainVignette = {
  uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 }, uGrain: { value: 0.025 }, uVignette: { value: 0.35 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFrame, uGrain, uVignette; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; d.x *= 1080.0 / 1920.0;
      float v = 1.0 - smoothstep(0.42, 0.95, length(d) * 1.35) * uVignette;
      float g = (hash(floor(gl_FragCoord.xy / 2.0) + uFrame * 7.31) - 0.5) * uGrain;
      gl_FragColor = vec4(c.rgb * v + g, c.a);
    }`
};

export function makeComposer(renderer, scene, camera, w, h, pr) {
  const target = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pr); composer.setSize(w, h);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w * pr / 2, h * pr / 2), 0.22, 0.4, 0.85);
  const output = new OutputPass();
  const smaa = new SMAAPass(w * pr, h * pr);
  const grain = new ShaderPass(GrainVignette);
  for (const p of [renderPass, bloom, output, smaa, grain]) composer.addPass(p);
  return { composer, grain, bloom, renderPass };
}
