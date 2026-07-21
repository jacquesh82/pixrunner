import { Container, Graphics } from 'pixi.js';
import type { LatLng, PowerType } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';
import { flashVignette } from '../ui/screenFx.js';

const METERS_PER_DEG_LAT = 111_320;

interface FxConfig {
  /** Durée totale (ms). */
  duration: number;
  color: number;
  /** Rayon final de l'onde de choc (m). */
  ringM: number;
  /** Second anneau décalé. */
  ring2?: boolean;
  /** Pilier vertical (tour). */
  pillar?: boolean;
  /** Étincelles en traits (sprint) plutôt qu'en points. */
  streaks?: boolean;
  /** Nombre d'étincelles. */
  sparks: number;
  /** Biais ascendant des étincelles (fortif). */
  upBias?: boolean;
}

/**
 * Identité visuelle d'activation de chaque pouvoir.
 * Couleurs vives et durées généreuses : l'effet doit se lire instantanément
 * par-dessus une carte claire et chargée.
 */
const CFG: Record<PowerType, FxConfig> = {
  assault: { duration: 900, color: 0xff2d1a, ringM: 55, ring2: true, sparks: 18 },
  fortify: { duration: 1100, color: 0xffa800, ringM: 48, ring2: true, sparks: 14, upBias: true },
  tower: { duration: 1300, color: 0x00d96b, ringM: 65, pillar: true, sparks: 16, upBias: true },
  sprint: { duration: 800, color: 0x00b4ff, ringM: 40, streaks: true, sparks: 20 },
  shield: { duration: 1600, color: 0x6d7dff, ringM: 130, ring2: true, sparks: 16 },
};

interface Spark {
  angle: number;
  /** Vitesse radiale (px/s). */
  speed: number;
  size: number;
}

interface Fx {
  cfg: FxConfig;
  lat: number;
  lng: number;
  start: number;
  sparks: Spark[];
}

const easeOut = (p: number): number => 1 - (1 - p) ** 3;

/**
 * VFX d'activation des pouvoirs, géo-ancrés sur la carte : onde de choc
 * (halo sombre + corps coloré + cœur blanc), nappe colorée, étincelles,
 * pilier. Un seul Graphics redessiné par frame. Le cœur blanc garantit la
 * lisibilité quel que soit le fond de carte.
 */
export class FxLayer {
  readonly container = new Container();
  private g = new Graphics();
  private effects: Fx[] = [];

  constructor(private overlay: PixiOverlay) {
    this.container.zIndex = 4; // au-dessus des avatars
    this.container.addChild(this.g);
    overlay.world.addChild(this.container);
    overlay.onReproject(() => this.frame());
  }

  /** Joue l'effet d'activation d'un pouvoir à une position géographique. */
  spawn(type: PowerType, pos: LatLng): void {
    const cfg = CFG[type];
    const sparks: Spark[] = [];
    for (let i = 0; i < cfg.sparks; i++) {
      sparks.push({
        angle: (i / cfg.sparks) * Math.PI * 2 + Math.random() * 0.5,
        speed: 70 + Math.random() * 110,
        size: 2.6 + Math.random() * 3,
      });
    }
    this.effects.push({ cfg, lat: pos.lat, lng: pos.lng, start: performance.now(), sparks });
    // Pulsation colorée aux bords de l'écran : signal impossible à rater.
    flashVignette(cfg.color);
  }

  private metersToPx(lat: number, lng: number, m: number): number {
    const a = this.overlay.project(lng, lat);
    const b = this.overlay.project(lng, lat + m / METERS_PER_DEG_LAT);
    return Math.abs(a.y - b.y);
  }

  private frame(): void {
    this.g.clear();
    if (this.effects.length === 0) return;
    const now = performance.now();
    this.effects = this.effects.filter((fx) => now - fx.start < fx.cfg.duration);

    for (const fx of this.effects) {
      const p = (now - fx.start) / fx.cfg.duration;
      const { cfg } = fx;
      const o = this.overlay.project(fx.lng, fx.lat);
      const rMax = this.metersToPx(fx.lat, fx.lng, cfg.ringM);
      const r1 = rMax * easeOut(p);

      // Nappe colorée qui s'étale sous l'onde : donne du corps à l'effet.
      if (r1 > 1) {
        this.g.ellipse(o.x, o.y, r1, r1 * 0.78).fill({ color: cfg.color, alpha: (1 - p) * 0.2 });
      }

      // Onde de choc principale.
      this.ring(o.x, o.y, r1, 1 - p, cfg.color);
      if (cfg.ring2) {
        const p2 = Math.max(0, Math.min(1, (p - 0.25) / 0.75));
        if (p2 > 0) {
          this.ring(o.x, o.y, rMax * 0.68 * easeOut(p2), (1 - p2) * 0.8, cfg.color);
        }
      }

      // Détonation centrale : disque coloré + cœur blanc.
      if (p < 0.42) {
        const q = 1 - p / 0.42;
        this.g.circle(o.x, o.y, 34 * q + 6).fill({ color: cfg.color, alpha: 0.5 * q });
        this.g.circle(o.x, o.y, 17 * q + 3).fill({ color: 0xffffff, alpha: 0.9 * q });
      }

      // Pilier d'énergie (tour) : faisceau vertical qui s'élève et s'évapore.
      if (cfg.pillar) {
        const hgt = 34 + easeOut(p) * 74;
        const alpha = (1 - p) * 0.95;
        this.beam(o.x, o.y, hgt, 16 * (1 - p) + 6, 0x0b2018, alpha * 0.3);
        this.beam(o.x, o.y, hgt, 10 * (1 - p) + 4, cfg.color, alpha);
        this.beam(o.x, o.y, hgt, 4 * (1 - p) + 1.5, 0xffffff, alpha * 0.9);
        this.g.circle(o.x, o.y - hgt, 7 * (1 - p) + 2.5).fill({ color: 0xffffff, alpha });
      }

      // Étincelles radiales (points, ou traits de vitesse pour Sprint).
      const ep = easeOut(p);
      for (const s of fx.sparks) {
        const upLift = cfg.upBias ? ep * 34 : 0;
        const r = s.speed * ep * (cfg.duration / 1000);
        const x = o.x + Math.cos(s.angle) * r;
        const y = o.y + Math.sin(s.angle) * r * 0.75 - upLift;
        const alpha = (1 - p) * 0.95;
        if (cfg.streaks) {
          const r0 = r * 0.5;
          const sx = o.x + Math.cos(s.angle) * r0;
          const sy = o.y + Math.sin(s.angle) * r0 * 0.75;
          this.g
            .moveTo(sx, sy)
            .lineTo(x, y)
            .stroke({ color: cfg.color, width: s.size + 2, alpha: alpha * 0.55, cap: 'round' });
          this.g
            .moveTo(sx, sy)
            .lineTo(x, y)
            .stroke({ color: 0xffffff, width: s.size * 0.5, alpha, cap: 'round' });
        } else {
          const sz = s.size * (1 - p * 0.5);
          this.g.circle(x, y, sz + 1.5).fill({ color: cfg.color, alpha: alpha * 0.6 });
          this.g.circle(x, y, sz * 0.55).fill({ color: 0xffffff, alpha });
        }
      }
    }
  }

  private beam(x: number, y: number, hgt: number, width: number, color: number, alpha: number): void {
    this.g.moveTo(x, y).lineTo(x, y - hgt).stroke({ color, width, alpha, cap: 'round' });
  }

  /** Anneau en trois passes : halo sombre, corps coloré, cœur blanc. */
  private ring(x: number, y: number, radius: number, alpha: number, color: number): void {
    if (radius <= 0.5) return;
    const ry = radius * 0.78; // ellipse aplatie : perspective au sol
    this.g.ellipse(x, y, radius, ry).stroke({ color: 0x0b1020, width: 13, alpha: alpha * 0.16 });
    this.g.ellipse(x, y, radius, ry).stroke({ color, width: 7.5, alpha: alpha * 0.85 });
    this.g.ellipse(x, y, radius, ry).stroke({ color: 0xffffff, width: 2.2, alpha: alpha * 0.9 });
  }
}
