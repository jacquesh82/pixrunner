import { POWER_COST, type PowerType } from '@pixirunner/protocol';

/**
 * Tuiles de pouvoirs « haut de gamme » : chaque pouvoir est une mini-scène
 * Canvas 2D animée et auto-portante — pseudo-3D (volumes, spéculaires, iso),
 * systèmes de particules dédiés, glows additifs. Un seul rAF partagé pour les
 * 5 tuiles (DPR-aware, ~120×84 px chacune → coût négligeable).
 */

const LABELS: Record<PowerType, string> = {
  assault: 'Assaut',
  fortify: 'Fortif',
  tower: 'Tour',
  sprint: 'Sprint',
  shield: 'Bouclier',
};

const TILE_W = 124;
const TILE_H = 84;

/** Couleur d'accent par pouvoir (barre d'état, chip, halo actif). */
const THEME: Record<PowerType, string> = {
  assault: '#ff5a3c',
  fortify: '#f0b429',
  tower: '#4ade80',
  sprint: '#38bdf8',
  shield: '#a5b4fc',
};

/** État vivant affiché sur une tuile (tout est optionnel). */
export interface TileStatus {
  /** Échéance (epoch ms) d'un pouvoir à durée — 0/absent si inactif. */
  until?: number;
  /** Durée totale (ms) pour la barre de progression. */
  duration?: number;
  /** Jauge 0..100 (ex. force de l'hex courant pour Fortif), null = masquée. */
  gauge?: number | null;
  /** Compteur (ex. tours posées), 0 = masqué. */
  count?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface Scene {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  t: number;
  dt: number;
  parts: Particle[];
  /** Intensité 0..1 : 1 quand le pouvoir est actif (les renderers s'embrasent). */
  boost: number;
}

export interface PowerTile {
  el: HTMLButtonElement;
  setEnabled(on: boolean): void;
  setStatus(status: TileStatus): void;
  destroy(): void;
}

/** Bruit déterministe (motifs stables sans état par tuile). */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function bg(s: Scene, top: string, bottom: string): void {
  const g = s.ctx.createLinearGradient(0, 0, 0, s.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  s.ctx.fillStyle = g;
  s.ctx.fillRect(0, 0, s.w, s.h);
}

/** Lueur radiale additive. */
function glow(s: Scene, x: number, y: number, r: number, color: string, alpha: number): void {
  const { ctx } = s;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function stepParts(s: Scene, drag = 1, gravity = 0): void {
  for (let i = s.parts.length - 1; i >= 0; i--) {
    const p = s.parts[i];
    p.life -= s.dt;
    if (p.life <= 0) {
      s.parts.splice(i, 1);
      continue;
    }
    p.vx *= drag;
    p.vy = p.vy * drag + gravity * s.dt;
    p.x += p.vx * s.dt;
    p.y += p.vy * s.dt;
  }
}

function drawPartsAdditive(s: Scene, sat: number, light: number): void {
  const { ctx } = s;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of s.parts) {
    const a = Math.min(1, p.life / (p.maxLife * 0.6));
    ctx.globalAlpha = a;
    ctx.fillStyle = `hsl(${p.hue} ${sat}% ${light}%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── ⚔️ Assaut : lames croisées, braises, flash de taillade ──────────────────

function blade(ctx: CanvasRenderingContext2D, len: number, wHalf: number): void {
  const g = ctx.createLinearGradient(0, -wHalf, 0, wHalf);
  g.addColorStop(0, '#f8fafc');
  g.addColorStop(0.5, '#cbd5e1');
  g.addColorStop(1, '#64748b');
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(-len * 0.7, -wHalf);
  ctx.lineTo(len * 0.8, -wHalf * 0.75);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.8, wHalf * 0.75);
  ctx.lineTo(-len * 0.7, wHalf);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  // arête spéculaire
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-len * 0.65, 0);
  ctx.lineTo(len * 0.92, 0);
  ctx.stroke();
}

function drawAssault(s: Scene): void {
  const { ctx, w, h, t } = s;
  bg(s, '#2b0a12', '#140508');
  glow(s, w / 2, h + 8, 52, '#ff5a2e', 0.28 + 0.1 * Math.sin(t * 3) + s.boost * 0.3);

  // braises montantes (déchaînées quand Assaut est actif)
  if (Math.random() < s.dt * (14 + s.boost * 36)) {
    s.parts.push({
      x: Math.random() * w,
      y: h + 3,
      vx: (Math.random() - 0.5) * 7,
      vy: -14 - Math.random() * 18,
      life: 1 + Math.random(),
      maxLife: 2,
      size: 0.8 + Math.random() * 1.6,
      hue: 15 + Math.random() * 25,
    });
  }
  stepParts(s, 0.995);
  drawPartsAdditive(s, 100, 58);

  // lames croisées (respiration légère)
  const cx = w / 2;
  const cy = h / 2 + 3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 1.8) * 0.05);
  ctx.shadowColor = '#ff3b30';
  ctx.shadowBlur = 10 + s.boost * 14;
  ctx.save();
  ctx.rotate(Math.PI / 4);
  blade(ctx, 26, 4);
  ctx.restore();
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  blade(ctx, 26, 4);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f0b429';
  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // flash de taillade périodique
  const cycle = t % 1.8;
  if (cycle < 0.35) {
    const p = cycle / 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = '#ffd7a0';
    ctx.lineWidth = 3 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 20 + p * 16, -2.4 + p * 1.4, -1.1 + p * 1.9);
    ctx.stroke();
    ctx.restore();
  }
}

// ── 🛡️ Fortif : bouclier 3D or/acier, spéculaire, étincelles ────────────────

function shieldPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(cx + r * 0.9, cy - r * 0.85, cx + r * 0.95, cy - r * 0.2, cx + r * 0.72, cy + r * 0.42);
  ctx.bezierCurveTo(cx + r * 0.5, cy + r * 0.85, cx + r * 0.2, cy + r, cx, cy + r * 1.12);
  ctx.bezierCurveTo(cx - r * 0.2, cy + r, cx - r * 0.5, cy + r * 0.85, cx - r * 0.72, cy + r * 0.42);
  ctx.bezierCurveTo(cx - r * 0.95, cy - r * 0.2, cx - r * 0.9, cy - r * 0.85, cx, cy - r);
  ctx.closePath();
}

function drawFortify(s: Scene): void {
  const { ctx, w, h, t } = s;
  bg(s, '#0c1631', '#070b1a');
  glow(s, w / 2, h * 0.62, 46, '#f0b429', 0.12 + 0.05 * Math.sin(t * 2));

  const cx = w / 2;
  const cy = h / 2 - 2;
  const r = 24;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 1 + Math.sin(t * 1.6) * 0.02); // léger tangage 3D
  ctx.translate(-cx, -cy);

  // corps acier bleuté
  shieldPath(ctx, cx, cy, r);
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, '#8fb0e0');
  g.addColorStop(0.55, '#3d5c94');
  g.addColorStop(1, '#22355c');
  ctx.fillStyle = g;
  ctx.shadowColor = '#4a86ff';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // liseré or + emblème
  shieldPath(ctx, cx, cy, r);
  ctx.strokeStyle = '#f0b429';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,180,41,0.95)';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * 7;
    const py = cy + 2 + Math.sin(a) * 7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // balayage spéculaire clippé dans le bouclier
  const sweep = ((t % 2.5) / 2.5) * (r * 4) - r * 2;
  shieldPath(ctx, cx, cy, r);
  ctx.save();
  ctx.clip();
  const sg = ctx.createLinearGradient(cx + sweep - 10, cy - r, cx + sweep + 10, cy + r);
  sg.addColorStop(0, 'transparent');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  sg.addColorStop(1, 'transparent');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = sg;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.restore();
  ctx.restore();

  // étincelles dorées scintillantes (déterministes)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = Math.pow(Math.sin(t * 2.2 + i * 2.1), 2);
    if (a < 0.25) continue;
    const px = cx + (hash(i * 7.3) - 0.5) * r * 2.6;
    const py = cy + (hash(i * 3.7) - 0.5) * r * 2.6;
    const sz = 1.6 + hash(i) * 2;
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = '#ffe9b0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - sz, py);
    ctx.lineTo(px + sz, py);
    ctx.moveTo(px, py - sz);
    ctx.lineTo(px, py + sz);
    ctx.stroke();
  }
  ctx.restore();
}

// ── 🗼 Tour : tour iso, balise pulsante, anneaux de régénération ────────────

function isoBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bw: number,
  bh: number,
  d: number,
  base: [string, string, string],
): void {
  const dy = d * 0.55;
  ctx.fillStyle = base[1]; // face avant
  ctx.fillRect(x - bw / 2, y, bw, bh);
  ctx.fillStyle = base[0]; // dessus (clair)
  ctx.beginPath();
  ctx.moveTo(x - bw / 2, y);
  ctx.lineTo(x - bw / 2 + d, y - dy);
  ctx.lineTo(x + bw / 2 + d, y - dy);
  ctx.lineTo(x + bw / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = base[2]; // côté (sombre)
  ctx.beginPath();
  ctx.moveTo(x + bw / 2, y);
  ctx.lineTo(x + bw / 2 + d, y - dy);
  ctx.lineTo(x + bw / 2 + d, y + bh - dy);
  ctx.lineTo(x + bw / 2, y + bh);
  ctx.closePath();
  ctx.fill();
}

function drawTower(s: Scene): void {
  const { ctx, w, h, t } = s;
  bg(s, '#07211d', '#03100e');

  const cx = w / 2 - 4;
  const groundY = h - 14;

  // plateforme iso
  ctx.fillStyle = '#0c3a33';
  ctx.beginPath();
  ctx.ellipse(cx + 3, groundY + 4, 30, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // anneaux de régénération en expansion
  for (const phase of [0, 0.5]) {
    const p = (t / 1.6 + phase) % 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - p) * 0.75;
    ctx.strokeStyle = p < 0.5 ? '#7be0d8' : '#4ade80';
    ctx.lineWidth = 2.4 - p * 1.6;
    ctx.beginPath();
    ctx.ellipse(cx + 3, groundY + 4, 6 + p * 26, 2 + p * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // tour : 3 blocs iso empilés
  isoBox(ctx, cx, groundY - 18, 22, 18, 7, ['#2f6b60', '#1d4a42', '#123129']);
  isoBox(ctx, cx, groundY - 32, 16, 14, 6, ['#3b8577', '#255c52', '#173b34']);
  isoBox(ctx, cx, groundY - 42, 10, 10, 5, ['#4a9f8e', '#2f6f63', '#1d463e']);

  // balise pulsante
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  glow(s, cx + 3, groundY - 46, 16 + pulse * 8, '#7be0d8', 0.55 * pulse + 0.2);
  ctx.fillStyle = '#d9fffa';
  ctx.beginPath();
  ctx.arc(cx + 3, groundY - 46, 3, 0, Math.PI * 2);
  ctx.fill();

  // motes de régénération montantes
  if (Math.random() < s.dt * 8) {
    s.parts.push({
      x: cx + (Math.random() - 0.5) * 44,
      y: groundY + 2,
      vx: (Math.random() - 0.5) * 3,
      vy: -8 - Math.random() * 8,
      life: 1.4 + Math.random(),
      maxLife: 2.4,
      size: 0.9 + Math.random() * 1.1,
      hue: 150 + Math.random() * 25,
    });
  }
  stepParts(s, 0.996);
  drawPartsAdditive(s, 85, 65);
}

// ── 💨 Sprint : chevrons séquentiels, lignes de vitesse, éclair ─────────────

function drawSprint(s: Scene): void {
  const { ctx, w, h, t } = s;
  bg(s, '#071a30', '#040a18');

  // lignes de vitesse défilantes (déterministes)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const speed = 90 + hash(i) * 130;
    const len = 12 + hash(i * 3.1) * 22;
    const y = 6 + hash(i * 1.7) * (h - 12);
    const x = w + len - ((t * speed + hash(i * 9.2) * 500) % (w + len * 2));
    const g = ctx.createLinearGradient(x, 0, x + len, 0);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, `rgba(125,211,252,${0.25 + hash(i * 5) * 0.4})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1 + hash(i * 2.3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();

  // éclair occasionnel
  const seed = Math.floor(t / 2.3);
  if (t % 2.3 < 0.14 && hash(seed) > 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.5 * hash(seed * 3 + Math.floor(t * 40));
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let lx = 6;
    let ly = 10 + hash(seed * 7) * 20;
    ctx.moveTo(lx, ly);
    for (let k = 0; k < 6; k++) {
      lx += (w - 12) / 6;
      ly += (hash(seed * 11 + k) - 0.5) * 22;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.restore();
  }

  // trois chevrons pulsés en séquence
  const cx = w / 2 - 14;
  const cy = h / 2;
  for (let i = 0; i < 3; i++) {
    const p = Math.pow(Math.max(0, Math.sin(t * 3.5 - i * 0.85)), 3);
    const x = cx + i * 15 + p * 4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.35 + p * 0.65 + s.boost * 0.3);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6 + p * 10 + s.boost * 8;
    ctx.strokeStyle = i === 2 ? '#bae6fd' : '#7dd3fc';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 4, cy - 13);
    ctx.lineTo(x + 7, cy);
    ctx.lineTo(x - 4, cy + 13);
    ctx.stroke();
    ctx.restore();
  }

  // particules de vent avec traînée (tempête quand Sprint est actif)
  if (Math.random() < s.dt * (20 + s.boost * 50)) {
    s.parts.push({
      x: -4,
      y: Math.random() * h,
      vx: 90 + Math.random() * 110,
      vy: (Math.random() - 0.5) * 6,
      life: 0.9,
      maxLife: 0.9,
      size: 1,
      hue: 200,
    });
  }
  stepParts(s);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of s.parts) {
    ctx.globalAlpha = Math.min(1, p.life / 0.5) * 0.7;
    ctx.strokeStyle = '#a5e3ff';
    ctx.lineWidth = p.size;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
    ctx.stroke();
  }
  ctx.restore();
}

// ── 🧊 Bouclier : dôme glacé, cristaux orbitaux en profondeur, neige ────────

function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -sz);
  ctx.lineTo(sz * 0.62, 0);
  ctx.lineTo(0, sz);
  ctx.lineTo(-sz * 0.62, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-sz, -sz, sz, sz);
  g.addColorStop(0, '#f3f7ff');
  g.addColorStop(1, '#8fb4ff');
  ctx.fillStyle = g;
  ctx.shadowColor = '#7be0ff';
  ctx.shadowBlur = 7;
  ctx.fill();
  ctx.restore();
}

function drawShield(s: Scene): void {
  const { ctx, w, h, t } = s;
  bg(s, '#0b1034', '#05071c');

  const cx = w / 2;
  const cy = h / 2 + 12;
  const R = 25;

  // aura quand le Bouclier est actif
  if (s.boost > 0) glow(s, cx, cy - 8, 34, '#a5b4fc', s.boost * 0.45);

  // sol hexagonal glacé
  ctx.strokeStyle = 'rgba(125,190,255,0.35)';
  ctx.fillStyle = 'rgba(30,45,110,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = cx + Math.cos(a) * (R + 7);
    const py = cy + Math.sin(a) * (R + 7) * 0.36;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // pulsation de gel au sol
  const fp = (t / 3) % 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (1 - fp) * 0.35;
  ctx.strokeStyle = '#9db8ff';
  ctx.beginPath();
  ctx.ellipse(cx, cy, (R + 4) * (0.4 + fp * 0.9), (R + 4) * 0.36 * (0.4 + fp * 0.9), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // cristaux orbitaux — moitié arrière derrière le dôme
  const orbits: Array<{ x: number; y: number; depth: number; rot: number; sz: number }> = [];
  for (let i = 0; i < 5; i++) {
    const a = t * 0.9 + (i * Math.PI * 2) / 5;
    orbits.push({
      x: cx + Math.cos(a) * (R + 9),
      y: cy - 6 + Math.sin(a) * 7,
      depth: Math.sin(a),
      rot: t * 1.5 + i,
      sz: 3.2,
    });
  }
  for (const o of orbits) {
    if (o.depth < 0) {
      ctx.globalAlpha = 0.45;
      crystal(ctx, o.x, o.y, o.sz * 0.8, o.rot);
      ctx.globalAlpha = 1;
    }
  }

  // dôme translucide
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.closePath();
  const dg = ctx.createRadialGradient(cx - 8, cy - R * 0.75, 2, cx, cy - 6, R * 1.25);
  dg.addColorStop(0, 'rgba(255,255,255,0.5)');
  dg.addColorStop(0.35, 'rgba(157,184,255,0.24)');
  dg.addColorStop(1, 'rgba(99,102,241,0.08)');
  ctx.fillStyle = dg;
  ctx.fill();
  // arête du dôme pulsante
  ctx.strokeStyle = `rgba(165,180,252,${0.45 + 0.3 * Math.sin(t * 1.8)})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.stroke();
  // base elliptique
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();
  // spéculaire
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy - R * 0.62, 6, 3, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // cristaux avant
  for (const o of orbits) {
    if (o.depth >= 0) crystal(ctx, o.x, o.y, o.sz * (0.85 + o.depth * 0.35), o.rot);
  }

  // neige lente
  if (Math.random() < s.dt * 6) {
    s.parts.push({
      x: Math.random() * w,
      y: -3,
      vx: (Math.random() - 0.5) * 4,
      vy: 7 + Math.random() * 6,
      life: 4,
      maxLife: 4,
      size: 0.8 + Math.random(),
      hue: 220,
    });
  }
  stepParts(s);
  drawPartsAdditive(s, 60, 85);
}

const RENDERERS: Record<PowerType, (s: Scene) => void> = {
  assault: drawAssault,
  fortify: drawFortify,
  tower: drawTower,
  sprint: drawSprint,
  shield: drawShield,
};

// ── Boucle d'animation partagée ─────────────────────────────────────────────

class TileInstance {
  readonly el: HTMLButtonElement;
  private scene: Scene;
  private enabled = false;
  private costEl: HTMLElement;
  private stateEl: HTMLElement;
  private lastChip = '';
  private status: TileStatus = {};

  constructor(
    private type: PowerType,
    onClick: () => void,
  ) {
    this.el = document.createElement('button');
    this.el.className = 'power-tile';
    this.el.dataset.power = type;
    this.el.style.setProperty('--pt-accent', THEME[type]);
    this.el.addEventListener('click', onClick);

    const canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = TILE_W * dpr;
    canvas.height = TILE_H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const name = document.createElement('span');
    name.className = 'pt-name';
    name.textContent = LABELS[type];

    this.costEl = document.createElement('span');
    this.costEl.className = 'pt-cost';
    this.costEl.textContent = `⚡${POWER_COST[type]}`;

    // Chip d'état vivant : « 12 s » (durée restante), « Force 62 », « ×2 »…
    this.stateEl = document.createElement('span');
    this.stateEl.className = 'pt-state';
    this.stateEl.hidden = true;

    this.el.append(canvas, name, this.costEl, this.stateEl);
    this.scene = { ctx, w: TILE_W, h: TILE_H, t: Math.random() * 10, dt: 0, parts: [], boost: 0 };
    this.frame(0); // première frame immédiate (même onglet throttlé)
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.el.disabled = !on;
    this.el.classList.toggle('affordable', on);
  }

  setStatus(status: TileStatus): void {
    this.status = status;
  }

  /** Fraction restante 0..1 d'un pouvoir à durée, ou 0 si inactif. */
  private remaining01(now: number): number {
    const { until, duration } = this.status;
    if (!until || !duration || until <= now) return 0;
    return Math.min(1, (until - now) / duration);
  }

  frame(dt: number): void {
    const now = Date.now();
    const remaining = this.remaining01(now);
    const active = remaining > 0;

    // Actif = plein régime même sans énergie ; sinon veille si non finançable.
    this.scene.boost = remaining;
    this.scene.dt = active || this.enabled ? dt : dt * 0.35;
    this.scene.t += this.scene.dt;
    RENDERERS[this.type](this.scene);
    this.drawStatusBar(remaining);

    // Chip d'état (mise à jour DOM seulement si le texte change).
    let chip = '';
    if (active && this.status.until) {
      chip = `${Math.ceil((this.status.until - now) / 1000)} s`;
    } else if (this.status.gauge !== undefined && this.status.gauge !== null) {
      chip = `Force ${Math.round(this.status.gauge)}`;
    } else if (this.status.count) {
      chip = `×${this.status.count}`;
    }
    if (chip !== this.lastChip) {
      this.lastChip = chip;
      this.stateEl.hidden = chip === '';
      this.stateEl.textContent = chip;
    }
    this.el.classList.toggle('active', active);
  }

  /** Barre d'état en haut de tuile : durée restante, ou jauge (ex. force). */
  private drawStatusBar(remaining: number): void {
    const { ctx, w } = this.scene;
    let frac = remaining;
    if (frac <= 0 && this.status.gauge !== undefined && this.status.gauge !== null) {
      frac = Math.max(0, Math.min(1, this.status.gauge / 100));
    }
    if (frac <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = THEME[this.type];
    ctx.globalAlpha = 0.28;
    ctx.fillRect(0, 0, w, 3.5);
    ctx.globalAlpha = 1;
    ctx.shadowColor = THEME[this.type];
    ctx.shadowBlur = 6;
    ctx.fillRect(0, 0, w * frac, 3.5);
    ctx.restore();
  }
}

const registry = new Set<TileInstance>();
let rafId: number | null = null;
let lastNow = 0;

function tick(now: number): void {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (!document.hidden) {
    for (const tile of registry) tile.frame(dt);
  }
  rafId = registry.size > 0 ? requestAnimationFrame(tick) : null;
}

export function createPowerTile(type: PowerType, onClick: () => void): PowerTile {
  const tile = new TileInstance(type, onClick);
  registry.add(tile);
  if (rafId === null) {
    lastNow = performance.now();
    rafId = requestAnimationFrame(tick);
  }
  return {
    el: tile.el,
    setEnabled: (on) => tile.setEnabled(on),
    setStatus: (status) => tile.setStatus(status),
    destroy: () => {
      registry.delete(tile);
      tile.el.remove();
    },
  };
}
