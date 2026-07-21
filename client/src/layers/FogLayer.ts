import { Container, Sprite, Texture } from 'pixi.js';
import type { LatLng } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';

const SIZE = 1024;
/** Demi-étendue géographique couverte par la texture de brouillard (~2,2 km). */
const HALF_SPAN_DEG = 0.02;
const REVEAL_RADIUS_M = 45;
const METERS_PER_DEG_LAT = 111_320;

/**
 * Brouillard d'exploration personnel (cosmétique, client uniquement).
 * Un canvas 2D ancré à la géographie autour du spawn : voile sombre au départ,
 * on y perce des trous adoucis (`destination-out` + dégradé radial) le long du
 * trajet, puis on re-upload la texture. Le compositing 2D est déterministe —
 * pas de dépendance aux blend modes WebGL de Pixi.
 */
export class FogLayer {
  readonly container = new Container();
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private texture: Texture;
  private sprite: Sprite;
  private west: number;
  private east: number;
  private north: number;
  private south: number;

  constructor(
    private overlay: PixiOverlay,
    origin: LatLng,
  ) {
    this.west = origin.lng - HALF_SPAN_DEG;
    this.east = origin.lng + HALF_SPAN_DEG;
    this.north = origin.lat + HALF_SPAN_DEG;
    this.south = origin.lat - HALF_SPAN_DEG;

    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx2d = this.canvas.getContext('2d')!;
    this.ctx2d.fillStyle = 'rgba(11, 16, 32, 0.45)';
    this.ctx2d.fillRect(0, 0, SIZE, SIZE);

    this.texture = Texture.from(this.canvas);
    this.sprite = new Sprite(this.texture);
    this.container.zIndex = 0; // sous toutes les couches de jeu
    this.container.addChild(this.sprite);
    overlay.world.addChild(this.container);
    overlay.onReproject(() => this.reproject());
  }

  /** Dissipe le brouillard autour d'une position (trou à bords adoucis). */
  reveal(pos: LatLng): void {
    const { x, y } = this.geoToTexture(pos);
    if (x < -SIZE * 0.1 || x > SIZE * 1.1 || y < -SIZE * 0.1 || y > SIZE * 1.1) return;
    const r = this.metersToPx(REVEAL_RADIUS_M);
    const ctx = this.ctx2d;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.65, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.texture.source.update();
  }

  private reproject(): void {
    const nw = this.overlay.project(this.west, this.north);
    const se = this.overlay.project(this.east, this.south);
    this.sprite.position.set(nw.x, nw.y);
    this.sprite.width = se.x - nw.x;
    this.sprite.height = se.y - nw.y;
  }

  private geoToTexture(pos: LatLng): { x: number; y: number } {
    const x = ((pos.lng - this.west) / (this.east - this.west)) * SIZE;
    const y = ((this.north - pos.lat) / (this.north - this.south)) * SIZE;
    return { x, y };
  }

  private metersToPx(m: number): number {
    const pxPerMeter = SIZE / (2 * HALF_SPAN_DEG * METERS_PER_DEG_LAT);
    return m * pxPerMeter;
  }
}
