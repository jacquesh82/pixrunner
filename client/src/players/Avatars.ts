import { Container, Graphics } from 'pixi.js';
import { PLAYER_COLORS } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';
import type { RoomStateView } from '../game/types.js';

interface Geo {
  lat: number;
  lng: number;
}

/** Rendu des avatars (soi + autres joueurs) reprojetés sur la carte. */
export class Avatars {
  readonly container = new Container();
  private dots = new Map<string, Graphics>();
  private geo = new Map<string, Geo>();

  constructor(
    private overlay: PixiOverlay,
    private selfId: () => string | undefined,
  ) {
    overlay.world.addChild(this.container);
    overlay.onReproject(() => this.reproject());
  }

  sync(state: RoomStateView): void {
    const seen = new Set<string>();
    state.players.forEach((p, key) => {
      seen.add(key);
      if (!this.dots.has(key)) {
        const dot = this.makeDot(p.colorIndex, key === this.selfId());
        this.dots.set(key, dot);
        this.container.addChild(dot);
      }
      this.geo.set(key, { lat: p.lat, lng: p.lng });
    });
    for (const [key, dot] of this.dots) {
      if (!seen.has(key)) {
        dot.destroy();
        this.dots.delete(key);
        this.geo.delete(key);
      }
    }
    this.reproject();
  }

  private makeDot(colorIndex: number, isSelf: boolean): Graphics {
    const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    const r = isSelf ? 9 : 7;
    const g = new Graphics();
    g.circle(0, 0, r).fill({ color, alpha: 1 });
    g.circle(0, 0, r).stroke({ color: 0xffffff, width: isSelf ? 3 : 2, alpha: 0.9 });
    return g;
  }

  private reproject(): void {
    for (const [key, dot] of this.dots) {
      const g = this.geo.get(key);
      if (!g) continue;
      const p = this.overlay.project(g.lng, g.lat);
      dot.position.set(p.x, p.y);
    }
  }
}
