import { MAX_ENERGY, POWER_COST, type PowerType } from '@pixirunner/protocol';

/** Libellés FR des pouvoirs (roue de pouvoirs). */
const POWER_LABELS: Record<PowerType, string> = {
  assault: 'Assaut',
  fortify: 'Fortif',
  tower: 'Tour',
  sprint: 'Sprint',
  shield: 'Bouclier',
};

export interface HudHandlers {
  onPower: (type: PowerType) => void;
}

const powerButtons = new Map<PowerType, HTMLButtonElement>();

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
    const b = document.createElement('button');
    b.className = 'power-btn';
    b.innerHTML = `<span>${POWER_LABELS[type]}</span><small>${POWER_COST[type]}</small>`;
    b.addEventListener('click', () => handlers.onPower(type));
    powerButtons.set(type, b);
    powers.appendChild(b);
  });

  hud.append(score, energyWrap, powers);
  root.appendChild(hud);
}

export function updateHud(state: { energy: number; score: number }): void {
  const fill = document.getElementById('energy-fill');
  if (fill) fill.style.width = `${Math.round((state.energy / MAX_ENERGY) * 100)}%`;
  const score = document.getElementById('hud-score');
  if (score) score.textContent = `Territoire : ${state.score}`;

  // Grise les pouvoirs non finançables.
  for (const [type, btn] of powerButtons) {
    btn.disabled = state.energy < POWER_COST[type];
  }
}
