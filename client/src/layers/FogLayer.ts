import { Application, Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import type { LatLng } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';

const SIZE = 2048;
/** Demi-étendue géographique couverte par la texture de brouillard (~2,2 km). */
const HALF_SPAN_DEG = 0.02;
const REVEAL_RADIUS_M = 45;
const METERS_PER_DEG_LAT = 111_320;

/**
 * Brouillard d'exploration personnel (cosmétique, client uniquement).
 * Une RenderTexture ancrée à la géographie autour du spawn : sombre au départ,
 * on efface un pinceau circulaire le long du trajet. Le sprite est reprojeté
 * chaque frame pour coller à la carte (carte orientée nord).
 */
export class FogLayer {
  readonly container = new Container();
  private app: Application;
  private rt: RenderTexture;
  private sprite: Sprite;
  private brush = new Graphics();
  private west: number;
  private east: number;
  private north: number;
  private south: number;

  constructor(
    private overlay: PixiOverlay,
    origin: LatLng,
  ) {
    this.app = overlay.app;
    this.west = origin.lng - HALF_SPAN_DEG;
    this.east = origin.lng + HALF_SPAN_DEG;
    this.north = origin.lat + HALF_SPAN_DEG;
    this.south = origin.lat - HALF_SPAN_DEG;

    this.rt = RenderTexture.create({ width: SIZE, height: SIZE });
    this.sprite = new Sprite(this.rt);
    this.container.zIndex = 0; // sous toutes les couches de jeu
    this.container.addChild(this.sprite);
    overlay.world.addChild(this.container);

    this.fillDark();
    overlay.onReproject(() => this.reproject());
  }

  /** Dissipe le brouillard autour d'une position. */
  reveal(pos: LatLng): void {
    const { x, y } = this.geoToRT(pos);
    if (x < 0 || x > SIZE || y < 0 || y > SIZE) return;
    this.brush.clear();
    this.brush.circle(x, y, this.metersToPx(REVEAL_RADIUS_M)).fill({ color: 0xffffff, alpha: 1 });
    this.brush.blendMode = 'erase';
    this.app.renderer.render({ container: this.brush, target: this.rt, clear: false });
  }

  private fillDark(): void {
    const g = new Graphics();
    g.rect(0, 0, SIZE, SIZE).fill({ color: 0x0b1020, alpha: 0.5 });
    this.app.renderer.render({ container: g, target: this.rt, clear: true });
    g.destroy();
  }

  private reproject(): void {
    const nw = this.overlay.project(this.west, this.north);
    const se = this.overlay.project(this.east, this.south);
    this.sprite.position.set(nw.x, nw.y);
    this.sprite.width = se.x - nw.x;
    this.sprite.height = se.y - nw.y;
  }

  private geoToRT(pos: LatLng): { x: number; y: number } {
    const x = ((pos.lng - this.west) / (this.east - this.west)) * SIZE;
    const y = ((this.north - pos.lat) / (this.north - this.south)) * SIZE;
    return { x, y };
  }

  private metersToPx(m: number): number {
    const pxPerMeter = SIZE / (2 * HALF_SPAN_DEG * METERS_PER_DEG_LAT);
    return m * pxPerMeter;
  }
}
