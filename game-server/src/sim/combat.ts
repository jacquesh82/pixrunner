import {
  ATTRITION_PER_TICK,
  DECAY_PER_TICK,
  HEX_CAPTURE_STRENGTH,
  HEX_MAX_STRENGTH,
  POWER_EFFECT,
  REGEN_PER_ALLY_NEIGHBOR,
} from '@pixirunner/protocol';
import { Hex, type Player, type TerritoryState } from '../rooms/schema.js';
import { neighbors } from '../game/geo.js';

/** Attribue un hex à un joueur (capture). */
function claim(hex: Hex, player: Player): void {
  hex.owner = player.id;
  hex.strength = HEX_CAPTURE_STRENGTH;
  player.score += 1;
}

/** Neutralise un hex (perte de territoire) et décrémente le score de l'ex-propriétaire. */
function neutralize(state: TerritoryState, hex: Hex): void {
  const prev = state.players.get(hex.owner);
  if (prev) prev.score = Math.max(0, prev.score - 1);
  hex.owner = '';
  hex.strength = 0;
  hex.tower = false;
}

/**
 * Entrée d'un joueur dans une cellule : capture (neutre), renforcement (allié)
 * ou attrition (ennemi → vidage de force puis bascule).
 */
export function enterHex(
  state: TerritoryState,
  player: Player,
  cell: string,
  attritionMultiplier: number,
): void {
  let hex = state.hexes.get(cell);
  if (!hex) {
    hex = new Hex();
    hex.id = cell;
    state.hexes.set(cell, hex);
  }

  if (hex.owner === '') {
    claim(hex, player);
  } else if (hex.owner === player.id) {
    hex.strength = Math.min(HEX_MAX_STRENGTH, hex.strength + 1);
  } else {
    hex.strength -= ATTRITION_PER_TICK * attritionMultiplier;
    if (hex.strength <= 0) {
      neutralize(state, hex);
      claim(hex, player);
    }
  }
}

/**
 * Capture en masse les cellules **neutres** d'une liste (boucle/enclosure).
 * Ne touche pas aux hex ennemis (ceux-ci passent par l'attrition).
 * Retourne le nombre de cellules capturées.
 */
export function claimNeutralCells(
  state: TerritoryState,
  player: Player,
  cells: string[],
  maxCells: number,
): number {
  let claimed = 0;
  for (const cell of cells) {
    if (claimed >= maxCells) break;
    let hex = state.hexes.get(cell);
    if (!hex) {
      hex = new Hex();
      hex.id = cell;
      state.hexes.set(cell, hex);
    }
    if (hex.owner === '') {
      claim(hex, player);
      claimed += 1;
    }
  }
  return claimed;
}

/**
 * Entretien du territoire à chaque tick : décroissance des hex non défendus,
 * régénération par fortification (voisins alliés) et par les tours/balises.
 * `shieldedOwners` : propriétaires dont un bouclier gèle la décroissance.
 */
export function maintain(state: TerritoryState, shieldedOwners: Set<string>): void {
  // Régénération apportée par les tours à leurs voisins alliés.
  const towerRegen = new Map<string, number>();
  state.hexes.forEach((hex, cell) => {
    if (!hex.tower || !hex.owner) return;
    for (const n of neighbors(cell)) {
      const nh = state.hexes.get(n);
      if (nh && nh.owner === hex.owner) {
        towerRegen.set(n, (towerRegen.get(n) ?? 0) + POWER_EFFECT.towerRegenPerTick);
      }
    }
  });

  state.hexes.forEach((hex, cell) => {
    if (!hex.owner) return;

    let allyNeighbors = 0;
    for (const n of neighbors(cell)) {
      const nh = state.hexes.get(n);
      if (nh && nh.owner === hex.owner) allyNeighbors += 1;
    }

    const regen =
      allyNeighbors * REGEN_PER_ALLY_NEIGHBOR + (towerRegen.get(cell) ?? 0);
    const decay = shieldedOwners.has(hex.owner) ? 0 : DECAY_PER_TICK;

    hex.strength = Math.min(HEX_MAX_STRENGTH, hex.strength + regen - decay);
    if (hex.strength <= 0) neutralize(state, hex);
  });
}
