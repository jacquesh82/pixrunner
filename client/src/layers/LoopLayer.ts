import { Container, Graphics } from 'pixi.js';
import {
  LOOP_CLOSE_DIST_M,
  LOOP_MIN_POINTS,
  TRAIL_SAMPLE_M,
  type LatLng,
} from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';
import { haversineMeters } from '../game/geo.js';

const FLASH_MS = 600;
const MAX_TRAIL = 400;

/**
 * Traînée du joueur + détection de boucle fermée. À la fermeture, envoie le
 * polygone au serveur (capture des hex neutres enclos) et joue un flash.
 */
export class LoopLayer {
  readonly container = new Container();
  private trailGfx = new Graphics();
  private flashGfx = new Graphics();
  private trail: LatLng[] = [];
  private flashPoly: LatLng[] | null = null;
  private flashStart = 0;
  /** Couleur cosmétique de la traînée (freemium). */
  private color = 0x4a86ff;

  setColor(color: number): void {
    this.color = color;
  }

  constructor(
    private overlay: PixiOverlay,
    private onClose: (polygon: LatLng[]) => void,
  ) {
    this.container.zIndex = 2; // au-dessus des hex, sous les avatars
    this.container.addChild(this.flashGfx, this.trailGfx);
    overlay.world.addChild(this.container);
    overlay.onReproject(() => this.frame());
  }

  addPoint(pos: LatLng): void {
    const last = this.trail[this.trail.length - 1];
    if (last && haversineMeters(last.lat, last.lng, pos.lat, pos.lng) < TRAIL_SAMPLE_M) {
      return;
    }

    // Fermeture : le point courant repasse près d'un point ancien de la traînée.
    for (let i = 0; i <= this.trail.length - LOOP_MIN_POINTS; i++) {
      const p = this.trail[i];
      if (haversineMeters(p.lat, p.lng, pos.lat, pos.lng) < LOOP_CLOSE_DIST_M) {
        const polygon = [...this.trail.slice(i), pos];
        this.onClose(polygon);
        this.flashPoly = polygon;
        this.flashStart = performance.now();
        this.trail = [pos];
        return;
      }
    }

    this.trail.push(pos);
    if (this.trail.length > MAX_TRAIL) this.trail.shift();
  }

  reset(): void {
    this.trail = [];
  }

  private frame(): void {
    this.trailGfx.clear();
    if (this.trail.length > 1) {
      const pts: number[] = [];
      for (const g of this.trail) {
        const p = this.overlay.project(g.lng, g.lat);
        pts.push(p.x, p.y);
      }
      this.trailGfx
        .poly(pts, false)
        .stroke({ color: this.color, width: 3, alpha: 0.7, cap: 'round', join: 'round' });
    }

    this.flashGfx.clear();
    if (this.flashPoly) {
      const t = (performance.now() - this.flashStart) / FLASH_MS;
      if (t >= 1) {
        this.flashPoly = null;
      } else {
        const pts: number[] = [];
        for (const g of this.flashPoly) {
          const p = this.overlay.project(g.lng, g.lat);
          pts.push(p.x, p.y);
        }
        this.flashGfx.poly(pts).fill({ color: this.color, alpha: 0.35 * (1 - t) });
      }
    }
  }
}
