// Small GeoJSON helpers shared by the sets.
import { project } from './proj.js';

export async function loadJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('missing ' + url); return r.json(); }
export async function loadFloat32(url) { const r = await fetch(url); return new Float32Array(await r.arrayBuffer()); }

/** Iterate every ring (outer and holes) of a Polygon / MultiPolygon as arrays of [lon, lat]. */
export function rings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}
/** Iterate every line of a LineString / MultiLineString. */
export function lines(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}
export const projectRing = ring => ring.map(([lon, lat]) => project(lon, lat));

/** Draw projected rings onto a 2D canvas context, mapping km -> pixels with (xmin, ymin, cell). */
export function tracePath(g, ringsKm, grid) {
  g.beginPath();
  for (const ring of ringsKm) {
    ring.forEach(([x, y], i) => {
      const px = (x - grid.xmin) / grid.cell, py = (y - grid.ymin) / grid.cell;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.closePath();
  }
}
/** Rasterize a drawing callback into a Float32 mask (0..1) the size of the terrain grid. */
export function rasterize(grid, draw) {
  const c = document.createElement('canvas'); c.width = grid.width; c.height = grid.height;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  draw(g);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const out = new Float32Array(grid.width * grid.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
  return out;
}
