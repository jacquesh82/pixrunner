/**
 * Constantes de gameplay partagées entre le game-server (autorité) et le client.
 * Une seule source de vérité → pas de désync des règles.
 */

/** Résolution H3 de la grille de territoire. 10 ≈ arête ~65 m (bon compromis marche/course). */
export const H3_RESOLUTION = 10;

/** Anti-triche : vitesse max plausible entre deux points GPS (m/s). ~43 km/h. */
export const MAX_SPEED_MPS = 12;

/** Force d'un hexagone : 0 = neutre/capturable, HEX_MAX_STRENGTH = cœur fortifié. */
export const HEX_MAX_STRENGTH = 100;

/** Force accordée à un hex fraîchement capturé. */
export const HEX_CAPTURE_STRENGTH = 40;

/** Combat / entretien du territoire (par tick de simulation). */
export const SIM_TICK_MS = 1000;
/** Force retirée à un hex ennemi traversé, par tick de présence. */
export const ATTRITION_PER_TICK = 25;
/** Décroissance passive d'un hex non défendu, par tick. */
export const DECAY_PER_TICK = 0.5;
/** Régénération d'un hex par voisin allié (fortification), par tick. */
export const REGEN_PER_ALLY_NEIGHBOR = 1.5;

/** Énergie générée par mètre parcouru. */
export const ENERGY_PER_METER = 0.2;
/** Énergie maximale stockable. */
export const MAX_ENERGY = 100;

/** Pouvoirs et leur coût en énergie. */
export const POWER_COST = {
  assault: 20, // vide la force d'un hex ennemi plus vite (multiplie l'attrition)
  fortify: 25, // booste la force d'un hex allié
  tower: 40, // pose une balise qui régénère les hex voisins
  sprint: 15, // vitesse temporaire
  shield: 35, // gèle la décroissance d'un quartier un moment
} as const;

export type PowerType = keyof typeof POWER_COST;

/** Effets numériques des pouvoirs. */
export const POWER_EFFECT = {
  /** Multiplicateur d'attrition sous Assaut. */
  assaultAttritionMultiplier: 2.5,
  /** Assaut : durée d'effet (ms). */
  assaultDurationMs: 15_000,
  /** Fortification : force ajoutée immédiatement (bornée à HEX_MAX_STRENGTH). */
  fortifyStrength: 60,
  /** Tour : rayon d'anneaux H3 régénérés autour de la balise. */
  towerRingRadius: 1,
  /** Tour : régénération par tick appliquée dans le rayon. */
  towerRegenPerTick: 4,
  /** Sprint : multiplicateur de vitesse et durée. */
  sprintMultiplier: 1.6,
  sprintDurationMs: 20_000,
  /** Bouclier : durée pendant laquelle la décroissance est gelée (ms). */
  shieldDurationMs: 60_000,
} as const;

/** Palette de teintes pastel distinctes attribuées aux joueurs (index → couleur). */
export const PLAYER_COLORS = [
  0x7bb0ff, // bleu pastel
  0xff9db0, // rose pastel
  0x9be3a2, // vert pastel
  0xffd27b, // ambre pastel
  0xc79bff, // violet pastel
  0x7be0d8, // turquoise pastel
  0xffb37b, // orange pastel
  0xe89bd0, // magenta pastel
] as const;
