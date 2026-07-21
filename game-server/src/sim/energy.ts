import {
  HEX_MAX_STRENGTH,
  POWER_COST,
  POWER_EFFECT,
  type PowerType,
} from '@pixirunner/protocol';
import type { Player, TerritoryState } from '../rooms/schema.js';

/** Minuteurs de pouvoirs par joueur (non répliqués). */
export interface PowerTimers {
  assaultUntil: number;
  sprintUntil: number;
  shieldUntil: number;
}

export function newTimers(): PowerTimers {
  return { assaultUntil: 0, sprintUntil: 0, shieldUntil: 0 };
}

export interface PowerOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Applique un pouvoir : vérifie l'énergie, applique l'effet (minuteur ou effet
 * immédiat sur la cellule sous le joueur) puis débite le coût.
 */
export function applyPower(
  state: TerritoryState,
  player: Player,
  cell: string,
  type: PowerType,
  timers: PowerTimers,
  now: number,
): PowerOutcome {
  const cost = POWER_COST[type];
  if (player.energy < cost) return { ok: false, reason: 'énergie insuffisante' };

  switch (type) {
    case 'assault':
      timers.assaultUntil = now + POWER_EFFECT.assaultDurationMs;
      break;
    case 'sprint':
      timers.sprintUntil = now + POWER_EFFECT.sprintDurationMs;
      break;
    case 'shield':
      timers.shieldUntil = now + POWER_EFFECT.shieldDurationMs;
      break;
    case 'fortify': {
      const hex = state.hexes.get(cell);
      if (!hex || hex.owner !== player.id) return { ok: false, reason: 'hex non allié' };
      hex.strength = Math.min(HEX_MAX_STRENGTH, hex.strength + POWER_EFFECT.fortifyStrength);
      break;
    }
    case 'tower': {
      const hex = state.hexes.get(cell);
      if (!hex || hex.owner !== player.id) return { ok: false, reason: 'hex non allié' };
      hex.tower = true;
      break;
    }
  }

  player.energy -= cost;
  return { ok: true };
}
