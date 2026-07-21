import { Schema, MapSchema, type } from '@colyseus/schema';

/** Joueur répliqué (miroir de PlayerState du protocol). */
export class Player extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') colorIndex = 0;
  @type('number') lat = 0;
  @type('number') lng = 0;
  @type('number') energy = 0;
  @type('number') score = 0;
  @type('boolean') guest = true;
  /** id de compte si connecté (vide en invité). */
  @type('string') accountId = '';
  /** Échéances (epoch ms) des pouvoirs à durée — 0 si inactif. Répliquées pour l'UI. */
  @type('number') assaultUntil = 0;
  @type('number') sprintUntil = 0;
  @type('number') shieldUntil = 0;
}

/** Hexagone possédé (miroir de HexState du protocol), indexé par id H3. */
export class Hex extends Schema {
  @type('string') id = '';
  @type('string') owner = '';
  @type('number') strength = 0;
  @type('boolean') tower = false;
}

/** État répliqué de la room. */
export class TerritoryState extends Schema {
  @type('string') scope = 'public';
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Hex }) hexes = new MapSchema<Hex>();
}
