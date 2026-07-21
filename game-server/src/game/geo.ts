import { latLngToCell, gridDisk } from 'h3-js';
import { H3_RESOLUTION } from '@pixirunner/protocol';

const EARTH_RADIUS_M = 6_371_000;

/** Distance haversine en mètres entre deux points géographiques. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cellule H3 (à la résolution de jeu) contenant un point. */
export function cellAt(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

/** Voisins immédiats d'une cellule (anneau 1, cellule centrale exclue). */
export function neighbors(cell: string): string[] {
  return gridDisk(cell, 1).filter((c) => c !== cell);
}
