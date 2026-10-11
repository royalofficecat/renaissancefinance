// California Albers (EPSG:3310) forward projection, GRS80 ellipsoid (Snyder 1987, eq. 14-1..14-12).
// lat1 = 34, lat2 = 40.5, lat0 = 0, lon0 = -120, false easting 0, false northing -4,000,000.
const a = 6378137;
const f = 1 / 298.257222101;
const e2 = 2 * f - f * f;
const e = Math.sqrt(e2);
const rad = Math.PI / 180;

const q = (phi) => {
  const s = Math.sin(phi);
  return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s)));
};
const m = (phi) => Math.cos(phi) / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);

const p1 = 34 * rad, p2 = 40.5 * rad, p0 = 0, l0 = -120 * rad;
const m1 = m(p1), m2 = m(p2), q1 = q(p1), q2 = q(p2), q0 = q(p0);
const n = (m1 * m1 - m2 * m2) / (q2 - q1);
const C = m1 * m1 + n * q1;
const rho0 = (a * Math.sqrt(C - n * q0)) / n;

/** [lon, lat] in degrees -> [x, y] in metres (EPSG:3310). */
export function albers(lon, lat) {
  const rho = (a * Math.sqrt(C - n * q(lat * rad))) / n;
  const th = n * (lon * rad - l0);
  return [rho * Math.sin(th), rho0 - rho * Math.cos(th) - 4000000];
}
