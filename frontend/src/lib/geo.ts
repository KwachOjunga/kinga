/** Horn of Africa map projection and simplified geography for God's View. */

export const MAP_BOUNDS = {
  minLon: 28,
  maxLon: 52,
  minLat: -6,
  maxLat: 18,
};

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface ScenePoint {
  x: number;
  z: number;
}

/** Equirectangular projection onto a 12×10 unit plane (X = lon, Z = lat). */
export function projectToScene({ lat, lon }: GeoPoint): ScenePoint {
  const { minLon, maxLon, minLat, maxLat } = MAP_BOUNDS;
  const x = ((lon - minLon) / (maxLon - minLon) - 0.5) * 12;
  const z = (0.5 - (lat - minLat) / (maxLat - minLat)) * 10;
  return { x, z };
}

/** Elevation hint for terrain shading (metres, stylised). */
export function elevationAt(lat: number, lon: number): number {
  const ethiopianHighlands = Math.exp(-((lat - 9) ** 2 / 18 + (lon - 38.5) ** 2 / 20)) * 2.8;
  const riftValley = Math.exp(-((lat - 1) ** 2 / 4 + (lon - 36) ** 2 / 6)) * -0.6;
  const coastal = Math.exp(-((lat + 2) ** 2 / 8 + (lon - 41) ** 2 / 30)) * 0.2;
  const noise = Math.sin(lat * 1.7 + lon * 0.9) * 0.15 + Math.cos(lon * 1.3 - lat * 0.8) * 0.1;
  return ethiopianHighlands + riftValley + coastal + noise;
}

/** Real WGS84 coordinates for admin units and gateways. */
export const ADMIN_COORDS: Record<string, GeoPoint> = {
  "KE-MSB-DROUGHT-01": { lat: 2.33, lon: 37.99 },
  "SO-GED-FLOOD-04": { lat: 3.52, lon: 42.21 },
  "ET-SOM-DROUGHT-02": { lat: 4.17, lon: 42.08 },
  "KE-TRK-DROUGHT-03": { lat: 3.12, lon: 35.6 },
  "UG-KAR-FLOOD-05": { lat: 2.53, lon: 34.67 },
  "DJ-ALI-DROUGHT-06": { lat: 11.16, lon: 42.72 },
  "ER-GBR-DROUGHT-07": { lat: 15.32, lon: 38.92 },
  "SS-JON-FLOOD-08": { lat: 9.53, lon: 31.65 },
  "SD-GED-DROUGHT-09": { lat: 13.19, lon: 30.22 },
};

export const GATEWAY_COORDS = [
  { id: "GW-NBO", label: "Nairobi Gateway", lat: -1.29, lon: 36.82 },
  { id: "GW-ADD", label: "Addis Gateway", lat: 9.03, lon: 38.75 },
];

/** Simplified country outlines [lon, lat][] — coarse Horn of Africa shapes. */
export const COUNTRY_OUTLINES: Record<string, GeoPoint[]> = {
  Kenya: [
    { lon: 33.9, lat: -4.7 },
    { lon: 41.9, lat: -4.7 },
    { lon: 41.9, lat: 4.6 },
    { lon: 39.2, lat: 4.6 },
    { lon: 36.0, lat: 0.5 },
    { lon: 34.0, lat: 4.6 },
    { lon: 33.9, lat: -4.7 },
  ],
  Ethiopia: [
    { lon: 33.0, lat: 3.4 },
    { lon: 38.0, lat: 3.4 },
    { lon: 42.0, lat: 8.0 },
    { lon: 48.0, lat: 8.0 },
    { lon: 48.0, lat: 14.5 },
    { lon: 36.0, lat: 14.5 },
    { lon: 33.0, lat: 10.0 },
    { lon: 33.0, lat: 3.4 },
  ],
  Somalia: [
    { lon: 41.0, lat: -1.7 },
    { lon: 51.4, lat: -1.7 },
    { lon: 51.4, lat: 12.0 },
    { lon: 43.0, lat: 12.0 },
    { lon: 41.0, lat: 8.0 },
    { lon: 41.0, lat: -1.7 },
  ],
  Uganda: [
    { lon: 29.6, lat: -1.5 },
    { lon: 35.0, lat: -1.5 },
    { lon: 35.0, lat: 4.2 },
    { lon: 29.6, lat: 4.2 },
    { lon: 29.6, lat: -1.5 },
  ],
};

/** Rough Indian Ocean + land mask sampling grid for terrain colour. */
export function isLand(lat: number, lon: number): boolean {
  if (lon < 29 || lon > 51 || lat < -5 || lat > 17) return false;
  if (lat < -1 && lon > 44) return false;
  if (lat > 12 && lon > 47) return false;
  if (lat < 0 && lon < 34) return lat > -2;
  return true;
}

export function landColor(lat: number, lon: number): [number, number, number] {
  const elev = elevationAt(lat, lon);
  if (!isLand(lat, lon)) return [0.02, 0.08, 0.14];
  if (elev > 1.5) return [0.28, 0.32, 0.22];
  if (elev > 0.5) return [0.35, 0.38, 0.2];
  if (elev < -0.2) return [0.42, 0.36, 0.22];
  return [0.22, 0.32, 0.16];
}
