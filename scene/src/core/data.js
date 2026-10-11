// Loading helpers for the prepared data in data/build/.
import * as THREE from 'three';

export const DATA = new URL('../data/build/', document.baseURI).href;

export const loadJSON = async (name) => (await fetch(DATA + name)).json();
export const loadBin = async (name) => (await fetch(DATA + name)).arrayBuffer();

/** Decode a PNG into raw RGBA bytes (row 0 = top of the image). */
export async function loadPixels(name) {
  const img = new Image();
  img.src = DATA + name;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  g.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: g.getImageData(0, 0, img.width, img.height, { colorSpace: 'srgb' }).data };
}

/** GPU texture from raw RGBA bytes; rows are flipped so uv (0,0) is the bottom-left (south-west). */
export function dataTexture({ w, h, data }, { mip = true } = {}) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(data.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mip;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Sample channel c (0..3) of pixel data at fractional pixel coords with bilinear filtering, 0..1. */
export function samplePix(px, x, y, c) {
  const { w, h, data } = px;
  x = Math.min(w - 1.001, Math.max(0, x - 0.5));
  y = Math.min(h - 1.001, Math.max(0, y - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const g = (xx, yy) => data[(yy * w + xx) * 4 + c];
  return ((g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy) / 255;
}
