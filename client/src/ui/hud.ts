import { MAX_ENERGY, POWER_COST, POWER_EFFECT, type PowerType } from '@pixirunner/protocol';
import { createPowerTile, type PowerTile } from './powerTiles.js';

export interface HudHandlers {
  onPower: (type: PowerType) => void;
}

export interface HudState {
  energy: number;
  score: number;
  /** Échéances (epoch ms) des pouvoirs à durée — 0 si inactif. */
  assaultUntil: number;
  sprintUntil: number;
  shieldUntil: number;
  /** Force de l'hex allié sous le joueur (null si hex non possédé). */
  hexStrength: number | null;
  /** Nombre de tours posées par le joueur. */
  towerCount: number;
}

const powerTiles = new Map<PowerType, PowerTile>();

export function buildHud(root: HTMLElement, handlers: HudHandlers): void {
  const hud = document.createElement('div');
  hud.id = 'hud';

  const score = document.createElement('div');
  score.id = 'hud-score';
  score.textContent = 'Territoire : 0';

  const energyWrap = document.createElement('div');
  energyWrap.id = 'energy';
  const energyFill = document.createElement('div');
  energyFill.id = 'energy-fill';
  energyWrap.appendChild(energyFill);

  const powers = document.createElement('div');
  powers.id = 'powers';
  (Object.keys(POWER_COST) as PowerType[]).forEach((type) => {
    const tile = createPowerTile(type, () => handlers.onPower(type));
    powerTiles.set(type, tile);
    powers.appendChild(tile.el);
  });

  hud.append(score, energyWrap, powers);
  root.appendChild(hud);
}

export function updateHud(state: HudState): void {
  const fill = document.getElementById('energy-fill');
  if (fill) fill.style.width = `${Math.round((state.energy / MAX_ENERGY) * 100)}%`;
  const score = document.getElementById('hud-score');
  if (score) score.textContent = `Territoire : ${state.score}`;

  // Active/désactive les tuiles selon l'énergie disponible.
  for (const [type, tile] of powerTiles) {
    tile.setEnabled(state.energy >= POWER_COST[type]);
  }

  // État vivant sur chaque tuile : durées restantes, force locale, tours posées.
  powerTiles.get('assault')?.setStatus({
    until: state.assaultUntil,
    duration: POWER_EFFECT.assaultDurationMs,
  });
  powerTiles.get('sprint')?.setStatus({
    until: state.sprintUntil,
    duration: POWER_EFFECT.sprintDurationMs,
  });
  powerTiles.get('shield')?.setStatus({
    until: state.shieldUntil,
    duration: POWER_EFFECT.shieldDurationMs,
  });
  powerTiles.get('fortify')?.setStatus({ gauge: state.hexStrength });
  powerTiles.get('tower')?.setStatus({ count: state.towerCount });
}
