import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { cellToBoundary } from 'h3-js';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { HEX_MAX_STRENGTH, PLAYER_COLORS } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';
import type { RoomStateView } from '../game/types.js';

const FLASH_MS = 500;
const NEUTRAL_COLOR = 0x9aa3af;

/** Mode extérieur / haut-contraste : renforce l'opacité pour la lisibilité au soleil. */
let highContrast = false;
export function setHexHighContrast(on: boolean): void {
  highContrast = on;
}

/** Styles partagés des labels de force (blanc, or quand fortifié à 100). */
const LABEL_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  fontWeight: '800',
  fill: 0xffffff,
  stroke: { color: 0x1c2430, width: 3 },
});
const LABEL_STYLE_MAX = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  fontWeight: '800',
  fill: 0xf0b429,
  stroke: { color: 0x1c2430, width: 3 },
});
/** Largeur d'hex à l'écran (px) sous laquelle on masque les labels. */
const LABEL_MIN_HEX_PX = 42;

/**
 * Rendu de la grille de territoire H3 depuis l'état serveur.
 * Couleur pastel = propriétaire, densité (alpha) = force (fortifié dense, bordure pâle),
 * contour fin pour la lecture, flash à la capture / au changement de propriétaire.
 */
export class HexLayer {
  readonly container = new Container();
  /** Couche des labels, toujours au-dessus des remplissages. */
  private labelBox = new Container();
  private labels = new Map<string, Text>();
  private gfx = new Map<string, Graphics>();
  private boundaries = new Map<string, Array<[number, number]>>();
  private owners = new Map<string, string>();
  private strengths = new Map<string, number>();
  /** ownerId → index de couleur (conservé même si le joueur quitte). */
  private ownerColor = new Map<string, number>();
  /** hexId → timestamp de début de flash. */
  private flash = new Map<string, number>();
  /** Cellules sponsorisées à mettre en avant (halo doré). */
  private sponsored = new Set<string>();
  /** Cellules portant une tour/balise (marqueur dessiné au centre). */
  private towers = new Set<string>();
  /** Propriétaire sous Bouclier actif (liseré glacé sur son territoire). */
  private shieldedOwner: string | null = null;
  private dirty = true;

  constructor(
    private overlay: PixiOverlay,
    map: MapLibreMap,
  ) {
    this.container.zIndex = 1; // fog(0) < hex(1) < loop(2) < avatars(3)
    this.container.addChild(this.labelBox); // les Graphics s'insèrent dessous (addChildAt 0)
    overlay.world.addChild(this.container);
    overlay.onReproject(() => this.frame());
    map.on('move', () => {
      this.dirty = true;
    });
  }

  /** Déclare les cellules sponsorisées (mises en avant même si non capturées). */
  setSponsored(cells: Set<string>): void {
    this.sponsored = cells;
    for (const cell of cells) {
      if (!this.gfx.has(cell)) {
        const g = new Graphics();
        this.gfx.set(cell, g);
        this.container.addChildAt(g, 0);
        this.boundaries.set(cell, cellToBoundary(cell) as Array<[number, number]>);
        this.owners.set(cell, '');
        this.strengths.set(cell, 0);
      }
    }
    this.dirty = true;
  }

  /** Active/désactive le liseré glacé sur le territoire d'un propriétaire. */
  setShieldedOwner(owner: string | null): void {
    if (owner === this.shieldedOwner) return;
    this.shieldedOwner = owner;
    this.dirty = true;
  }

  sync(state: RoomStateView): void {
    state.players.forEach((p) => this.ownerColor.set(p.id, p.colorIndex));

    const seen = new Set<string>();
    state.hexes.forEach((h, key) => {
      seen.add(key);
      if (h.tower) this.towers.add(key);
      else this.towers.delete(key);
      if (!this.gfx.has(key)) {
        const g = new Graphics();
        this.gfx.set(key, g);
        this.container.addChildAt(g, 0);
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
        this.towers.delete(key);
        this.labels.get(key)?.destroy();
        this.labels.delete(key);
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
      let minX = Infinity;
      let maxX = -Infinity;
      let mx = 0;
      let my = 0;
      for (const [lat, lng] of boundary) {
        const p = this.overlay.project(lng, lat);
        pts.push(p.x, p.y);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        mx += p.x;
        my += p.y;
      }
      mx /= boundary.length;
      my /= boundary.length;

      const owner = this.owners.get(key) ?? '';
      const strength = this.strengths.get(key) ?? 0;
      const colorIndex = this.ownerColor.get(owner);
      const color =
        colorIndex !== undefined
          ? PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
          : NEUTRAL_COLOR;

      const base = highContrast ? 0.35 : 0.15;
      const span = highContrast ? 0.5 : 0.4;
      let alpha = owner ? base + span * (strength / HEX_MAX_STRENGTH) : 0.06;
      const start = this.flash.get(key);
      if (start !== undefined) {
        const t = (now - start) / FLASH_MS;
        if (t >= 1) this.flash.delete(key);
        else alpha += 0.45 * (1 - t);
      }

      g.clear();
      g.poly(pts).fill({ color, alpha: Math.min(1, alpha) });
      if (this.sponsored.has(key)) {
        // Halo doré discret sur les zones sponsorisées.
        g.poly(pts).stroke({ color: 0xf0b429, width: 2.5, alpha: 0.9 });
      } else if (owner && owner === this.shieldedOwner) {
        // Bouclier actif : liseré glacé sur le territoire protégé.
        g.poly(pts).stroke({ color: 0xa5b4fc, width: 2.5, alpha: 0.95 });
      } else {
        g.poly(pts).stroke({ color, width: highContrast ? 2 : 1, alpha: highContrast ? 0.8 : 0.5 });
      }

      // Tour/balise : losange lumineux au centre de la cellule.
      const hasTower = this.towers.has(key);
      if (hasTower) {
        const r = 5;
        g.poly([mx, my - r, mx + r * 0.7, my, mx, my + r, mx - r * 0.7, my]).fill({
          color: 0x4ade80,
          alpha: 0.95,
        });
        g.circle(mx, my, r + 3).stroke({ color: 0x4ade80, width: 1.5, alpha: 0.5 });
      }

      // Label de force au centre de l'hex possédé (or quand fortifié à 100).
      const showLabel = owner !== '' && maxX - minX >= LABEL_MIN_HEX_PX;
      let label = this.labels.get(key);
      if (showLabel) {
        if (!label) {
          label = new Text({ text: '', style: LABEL_STYLE });
          label.anchor.set(0.5);
          this.labels.set(key, label);
          this.labelBox.addChild(label);
        }
        const value = String(Math.round(strength));
        if (label.text !== value) label.text = value;
        const maxed = strength >= HEX_MAX_STRENGTH - 0.5;
        const wanted = maxed ? LABEL_STYLE_MAX : LABEL_STYLE;
        if (label.style !== wanted) label.style = wanted;
        // Décale le label si une tour occupe le centre.
        label.position.set(mx, hasTower ? my + 11 : my);
        label.alpha = 0.92;
        label.visible = true;
      } else if (label) {
        label.visible = false;
      }
    }
  }
}
