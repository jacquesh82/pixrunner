import { Application, Container } from 'pixi.js';
import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Superpose un canvas PixiJS à la carte MapLibre et le maintient synchronisé.
 * Chaque objet de jeu stocke sa position géographique ; à chaque frame Pixi on
 * reprojette (`map.project`) en coordonnées écran → la couche de jeu « colle » à
 * la carte pendant les pan/zoom. Pattern « pixi-overlay ».
 */
export class PixiOverlay {
  readonly app = new Application();
  readonly world = new Container();
  private reprojectors: Array<() => void> = [];
  private map!: MapLibreMap;

  async init(map: MapLibreMap, container: HTMLElement): Promise<void> {
    this.map = map;
    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    this.app.canvas.id = 'pixi-overlay';
    container.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.app.ticker.add(() => {
      for (const reproject of this.reprojectors) reproject();
    });
  }

  /** Coordonnée écran d'un point géographique, à l'instant courant de la carte. */
  project(lng: number, lat: number): { x: number; y: number } {
    const p = this.map.project([lng, lat]);
    return { x: p.x, y: p.y };
  }

  /** Enregistre une couche qui doit se reprojeter à chaque frame. */
  onReproject(cb: () => void): void {
    this.reprojectors.push(cb);
  }
}
