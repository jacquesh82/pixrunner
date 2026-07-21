import { Container, Graphics } from 'pixi.js';
import type { LatLng, PowerType } from '@pixirunner/protocol';
import type { PixiOverlay } from '../map/PixiOverlay.js';

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

/** Identité visuelle d'activation de chaque pouvoir. */
const CFG: Record<PowerType, FxConfig> = {
  assault: { duration: 650, color: 0xff5a3c, ringM: 45, sparks: 14 },
  fortify: { duration: 850, color: 0xf0b429, ringM: 40, ring2: true, sparks: 10, upBias: true },
  tower: { duration: 950, color: 0x4ade80, ringM: 55, pillar: true, sparks: 12, upBias: true },
  sprint: { duration: 550, color: 0x38bdf8, ringM: 30, streaks: true, sparks: 16 },
  shield: { duration: 1250, color: 0xa5b4fc, ringM: 120, ring2: true, sparks: 12 },
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
 * VFX d'activation des pouvoirs, géo-ancrés sur la carte (onde de choc,
 * étincelles, pilier). Un seul Graphics redessiné par frame ; double trait
 * (ombre sombre + couleur saturée) pour rester lisible sur carte claire.
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
        speed: 55 + Math.random() * 80,
        size: 1.6 + Math.random() * 2,
      });
    }
    this.effects.push({ cfg, lat: pos.lat, lng: pos.lng, start: performance.now(), sparks });
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

      // Onde de choc principale (ombre sombre + couleur — lisible sur carte claire).
      this.ring(o.x, o.y, this.metersToPx(fx.lat, fx.lng, cfg.ringM) * easeOut(p), 1 - p, cfg.color);
      if (cfg.ring2) {
        const p2 = Math.max(0, Math.min(1, (p - 0.22) / 0.78));
        if (p2 > 0) {
          this.ring(
            o.x,
            o.y,
            this.metersToPx(fx.lat, fx.lng, cfg.ringM * 0.7) * easeOut(p2),
            (1 - p2) * 0.7,
            cfg.color,
          );
        }
      }

      // Flash central bref.
      if (p < 0.3) {
        this.g.circle(o.x, o.y, 10 * (1 - p / 0.3)).fill({ color: 0xffffff, alpha: 0.7 * (1 - p / 0.3) });
      }

      // Pilier d'énergie (tour) : faisceau vertical qui s'élève et s'évapore.
      if (cfg.pillar) {
        const hgt = 26 + easeOut(p) * 46;
        const alpha = (1 - p) * 0.85;
        this.g
          .moveTo(o.x, o.y)
          .lineTo(o.x, o.y - hgt)
          .stroke({ color: 0x123024, width: 7 * (1 - p) + 3, alpha: alpha * 0.4, cap: 'round' });
        this.g
          .moveTo(o.x, o.y)
          .lineTo(o.x, o.y - hgt)
          .stroke({ color: cfg.color, width: 4.5 * (1 - p) + 1.5, alpha, cap: 'round' });
        this.g.circle(o.x, o.y - hgt, 3.5 * (1 - p) + 1).fill({ color: 0xffffff, alpha });
      }

      // Étincelles radiales (points, ou traits de vitesse pour Sprint).
      const ep = easeOut(p);
      for (const s of fx.sparks) {
        const upLift = cfg.upBias ? ep * 26 : 0;
        const r = s.speed * ep * (cfg.duration / 1000);
        const x = o.x + Math.cos(s.angle) * r;
        const y = o.y + Math.sin(s.angle) * r * 0.75 - upLift;
        const alpha = (1 - p) * 0.95;
        if (cfg.streaks) {
          const r0 = r * 0.55;
          this.g
            .moveTo(o.x + Math.cos(s.angle) * r0, o.y + Math.sin(s.angle) * r0 * 0.75)
            .lineTo(x, y)
            .stroke({ color: cfg.color, width: s.size, alpha, cap: 'round' });
        } else {
          this.g.circle(x, y, s.size * (1 - p * 0.6)).fill({ color: cfg.color, alpha });
        }
      }
    }
  }

  private ring(x: number, y: number, radius: number, alpha: number, color: number): void {
    if (radius <= 0.5) return;
    // Ellipse légèrement aplatie : impression de perspective au sol.
    this.g.ellipse(x, y, radius, radius * 0.78).stroke({
      color: 0x141a2a,
      width: 4.5,
      alpha: alpha * 0.35,
    });
    this.g.ellipse(x, y, radius, radius * 0.78).stroke({ color, width: 2.6, alpha });
  }
}
