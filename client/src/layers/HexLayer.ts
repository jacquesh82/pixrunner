import { Container, Graphics } from 'pixi.js';
import { cellToBoundary } from 'h3-js';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { HEX_MAX_STRENGTH, PLAYER_COLORS } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';
import type { RoomStateView } from '../game/types.js';

const FLASH_MS = 500;
const NEUTRAL_COLOR = 0x9aa3af;

/**
 * Rendu de la grille de territoire H3 depuis l'état serveur.
 * Couleur pastel = propriétaire, densité (alpha) = force (fortifié dense, bordure pâle),
 * contour fin pour la lecture, flash à la capture / au changement de propriétaire.
 */
export class HexLayer {
  readonly container = new Container();
  private gfx = new Map<string, Graphics>();
  private boundaries = new Map<string, Array<[number, number]>>();
  private owners = new Map<string, string>();
  private strengths = new Map<string, number>();
  /** ownerId → index de couleur (conservé même si le joueur quitte). */
  private ownerColor = new Map<string, number>();
  /** hexId → timestamp de début de flash. */
  private flash = new Map<string, number>();
  private dirty = true;

  constructor(
    private overlay: PixiOverlay,
    map: MapLibreMap,
  ) {
    overlay.world.addChildAt(this.container, 0); // sous les avatars
    overlay.onReproject(() => this.frame());
    map.on('move', () => {
      this.dirty = true;
    });
  }

  sync(state: RoomStateView): void {
    state.players.forEach((p) => this.ownerColor.set(p.id, p.colorIndex));

    const seen = new Set<string>();
    state.hexes.forEach((h, key) => {
      seen.add(key);
      if (!this.gfx.has(key)) {
        const g = new Graphics();
        this.gfx.set(key, g);
        this.container.addChild(g);
        this.boundaries.set(key, cellToBoundary(key) as Array<[number, number]>);
      }
      const prevOwner = this.owners.get(key);
      if (h.owner && h.owner !== prevOwner) {
        this.flash.set(key, performance.now());
      }
      this.owners.set(key, h.owner);
      this.strengths.set(key, h.strength);
    });

    for (const [key, g] of this.gfx) {
      if (!seen.has(key)) {
        g.destroy();
        this.gfx.delete(key);
        this.boundaries.delete(key);
        this.owners.delete(key);
        this.strengths.delete(key);
        this.flash.delete(key);
      }
    }
    this.dirty = true;
  }

  private frame(): void {
    if (!this.dirty && this.flash.size === 0) return;
    this.redraw();
    this.dirty = false;
  }

  private redraw(): void {
    const now = performance.now();
    for (const [key, g] of this.gfx) {
      const boundary = this.boundaries.get(key);
      if (!boundary) continue;

      const pts: number[] = [];
      for (const [lat, lng] of boundary) {
        const p = this.overlay.project(lng, lat);
        pts.push(p.x, p.y);
      }

      const owner = this.owners.get(key) ?? '';
      const strength = this.strengths.get(key) ?? 0;
      const colorIndex = this.ownerColor.get(owner);
      const color =
        colorIndex !== undefined
          ? PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
          : NEUTRAL_COLOR;

      let alpha = owner ? 0.15 + 0.4 * (strength / HEX_MAX_STRENGTH) : 0.06;
      const start = this.flash.get(key);
      if (start !== undefined) {
        const t = (now - start) / FLASH_MS;
        if (t >= 1) this.flash.delete(key);
        else alpha += 0.45 * (1 - t);
      }

      g.clear();
      g.poly(pts).fill({ color, alpha: Math.min(1, alpha) });
      g.poly(pts).stroke({ color, width: 1, alpha: 0.5 });
    }
  }
}
