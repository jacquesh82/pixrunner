import { MAX_ENERGY, POWER_COST, type PowerType } from '@pixirunner/protocol';
import { createPowerTile, type PowerTile } from './powerTiles.js';

export interface HudHandlers {
  onPower: (type: PowerType) => void;
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

export function updateHud(state: { energy: number; score: number }): void {
  const fill = document.getElementById('energy-fill');
  if (fill) fill.style.width = `${Math.round((state.energy / MAX_ENERGY) * 100)}%`;
  const score = document.getElementById('hud-score');
  if (score) score.textContent = `Territoire : ${state.score}`;

  // Active/désactive les tuiles selon l'énergie disponible.
  for (const [type, tile] of powerTiles) {
    tile.setEnabled(state.energy >= POWER_COST[type]);
  }
}
