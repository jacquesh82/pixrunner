import type { InputKind, Position, PositionSource } from './PositionSource.js';

/** Directions ZQSD/WASD/flèches → vecteur (est, nord). */
const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  KeyZ: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  KeyQ: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

const METERS_PER_DEG_LAT = 111_320;

/** Déplacement au clavier pour tester sur desktop sans marcher. */
export class KeyboardSource implements PositionSource {
  readonly kind: InputKind = 'keyboard';

  private pressed = new Set<string>();
  private pos: Position;
  private timer?: number;
  private lastT = 0;
  private cb?: (pos: Position) => void;
  private speedMps = 4.5; // allure course

  constructor(start: Position) {
    this.pos = { ...start };
  }

  start(onPosition: (pos: Position) => void): void {
    this.cb = onPosition;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.lastT = performance.now();
    this.timer = window.setInterval(() => this.step(), 100);
    this.cb(this.pos);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.timer) window.clearInterval(this.timer);
    this.pressed.clear();
  }

  /** Resynchronise la position de départ (ex. après un fix GPS). */
  setPosition(pos: Position): void {
    this.pos = { ...pos };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (KEY_DIRS[e.code]) {
      this.pressed.add(e.code);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };

  private step(): void {
    const now = performance.now();
    const dt = (now - this.lastT) / 1000;
    this.lastT = now;

    let dx = 0;
    let dy = 0;
    for (const code of this.pressed) {
      const d = KEY_DIRS[code];
      if (d) {
        dx += d[0];
        dy += d[1];
      }
    }
    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy);
    const dist = this.speedMps * dt;
    const dLat = ((dy / len) * dist) / METERS_PER_DEG_LAT;
    const dLng =
      ((dx / len) * dist) /
      (METERS_PER_DEG_LAT * Math.cos((this.pos.lat * Math.PI) / 180));

    this.pos = { lat: this.pos.lat + dLat, lng: this.pos.lng + dLng };
    this.cb?.(this.pos);
  }
}
