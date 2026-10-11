// California Albers equal-area conic (the state's standard projection, EPSG 3310),
// spherical form, in kilometres. Shared by the data-prep script (Node) and the scene (browser).
const R = 6371;
const d2r = Math.PI / 180;
const lat1 = 34 * d2r, lat2 = 40.5 * d2r, lat0 = 0, lon0 = -120 * d2r;
const n = (Math.sin(lat1) + Math.sin(lat2)) / 2;
const C = Math.cos(lat1) ** 2 + 2 * n * Math.sin(lat1);
const rho0 = R * Math.sqrt(C - 2 * n * Math.sin(lat0)) / n;

// Map origin: this lon/lat lands at (0, 0) so scene coordinates stay small.
export const ORIGIN = { lon: -119.5, lat: 37.25 };

function rawProject(lon, lat) {
  const phi = lat * d2r, lam = lon * d2r;
  const rho = R * Math.sqrt(C - 2 * n * Math.sin(phi)) / n;
  const theta = n * (lam - lon0);
  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}
const O = rawProject(ORIGIN.lon, ORIGIN.lat);

/** lon/lat (degrees) -> [x east, y north] in km, relative to ORIGIN */
export function project(lon, lat) {
  const [x, y] = rawProject(lon, lat);
  return [x - O[0], y - O[1]];
}

/** [x, y] km relative to ORIGIN -> [lon, lat] degrees */
export function unproject(x, y) {
  const X = x + O[0], Y = y + O[1];
  const rho = Math.sqrt(X * X + (rho0 - Y) ** 2);
  const theta = Math.atan2(X, rho0 - Y);
  const phi = Math.asin((C - (rho * n / R) ** 2) / (2 * n));
  return [(lon0 + theta / n) / d2r, phi / d2r];
}

/** Web Mercator tile pixel coordinates at zoom z (256 px tiles) */
export function mercPixel(lon, lat, z) {
  const s = 256 * 2 ** z;
  const x = (lon + 180) / 360 * s;
  const phi = lat * d2r;
  const y = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * s;
  return [x, y];
}
