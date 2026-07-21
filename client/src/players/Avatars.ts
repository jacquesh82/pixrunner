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

  private makeDot(colorIndex: number, isSelf: boolean): Graphics {
    const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    const r = isSelf ? 9 : 7;
    const g = new Graphics();
    g.circle(0, 0, r).fill({ color, alpha: 1 });
    g.circle(0, 0, r).stroke({ color: 0xffffff, width: isSelf ? 3 : 2, alpha: 0.9 });
    return g;
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
