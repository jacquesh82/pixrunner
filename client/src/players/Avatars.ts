import { Container, Graphics } from 'pixi.js';
import { PLAYER_COLORS } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';
import type { RoomStateView } from '../game/types.js';

interface Geo {
  lat: number;
  lng: number;
}

/** Facteur de lissage par frame vers la dernière position serveur. */
const LERP = 0.18;

/** Rendu des avatars (soi + autres joueurs), interpolé entre les patches serveur. */
export class Avatars {
  readonly container = new Container();
  private dots = new Map<string, Graphics>();
  private cur = new Map<string, Geo>();
  private target = new Map<string, Geo>();
  /** Couleur cosmétique de l'avatar du joueur (freemium), sinon couleur attribuée. */
  private selfColor?: number;

  constructor(
    private overlay: PixiOverlay,
    private selfId: () => string | undefined,
  ) {
    this.container.zIndex = 3; // au-dessus de fog/hex/loop
    overlay.world.addChild(this.container);
    overlay.onReproject(() => this.frame());
  }

  sync(state: RoomStateView): void {
    const seen = new Set<string>();
    state.players.forEach((p, key) => {
      seen.add(key);
      if (!this.dots.has(key)) {
        const dot = this.makeDot(p.colorIndex, key === this.selfId());
        this.dots.set(key, dot);
        this.container.addChild(dot);
        this.cur.set(key, { lat: p.lat, lng: p.lng });
      }
      this.target.set(key, { lat: p.lat, lng: p.lng });
    });
    for (const [key, dot] of this.dots) {
      if (!seen.has(key)) {
        dot.destroy();
        this.dots.delete(key);
        this.cur.delete(key);
        this.target.delete(key);
      }
    }
  }

  /** Applique une couleur d'avatar cosmétique au joueur. */
  setSelfColor(color?: number): void {
    this.selfColor = color;
    const id = this.selfId();
    const dot = id ? this.dots.get(id) : undefined;
    if (dot) this.drawDot(dot, this.selfColor ?? 0x4a86ff, true);
  }

  private makeDot(colorIndex: number, isSelf: boolean): Graphics {
    const color = isSelf && this.selfColor !== undefined
      ? this.selfColor
      : PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    const g = new Graphics();
    this.drawDot(g, color, isSelf);
    return g;
  }

  private drawDot(g: Graphics, color: number, isSelf: boolean): void {
    const r = isSelf ? 9 : 7;
    g.clear();
    g.circle(0, 0, r).fill({ color, alpha: 1 });
    g.circle(0, 0, r).stroke({ color: 0xffffff, width: isSelf ? 3 : 2, alpha: 0.9 });
  }

  /** Appelée chaque frame : interpole puis reprojette sur la carte. */
  private frame(): void {
    for (const [key, dot] of this.dots) {
      const cur = this.cur.get(key);
      const tgt = this.target.get(key);
      if (!cur || !tgt) continue;
      cur.lat += (tgt.lat - cur.lat) * LERP;
      cur.lng += (tgt.lng - cur.lng) * LERP;
      const p = this.overlay.project(cur.lng, cur.lat);
      dot.position.set(p.x, p.y);
    }
  }
}
