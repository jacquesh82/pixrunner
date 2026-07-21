import {
  HEX_MAX_STRENGTH,
  POWER_COST,
  POWER_EFFECT,
  type PowerType,
} from '@pixirunner/protocol';
import type { Player, TerritoryState } from '../rooms/schema.js';

export interface PowerOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Applique un pouvoir : vérifie l'énergie, applique l'effet (échéance répliquée
 * sur le joueur ou effet immédiat sur la cellule sous lui) puis débite le coût.
 * Les échéances vivent dans le schema → l'UI les affiche en direct.
 */
export function applyPower(
  state: TerritoryState,
  player: Player,
  cell: string,
  type: PowerType,
  now: number,
): PowerOutcome {
  const cost = POWER_COST[type];
  if (player.energy < cost) return { ok: false, reason: 'énergie insuffisante' };

  switch (type) {
    case 'assault':
      player.assaultUntil = now + POWER_EFFECT.assaultDurationMs;
      break;
    case 'sprint':
      player.sprintUntil = now + POWER_EFFECT.sprintDurationMs;
      break;
    case 'shield':
      player.shieldUntil = now + POWER_EFFECT.shieldDurationMs;
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
