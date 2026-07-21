/** Vue côté client de l'état répliqué (structurellement identique au schema serveur). */
export interface RemotePlayer {
  id: string;
  name: string;
  colorIndex: number;
  lat: number;
  lng: number;
  energy: number;
  score: number;
  guest: boolean;
  /** Échéances (epoch ms) des pouvoirs à durée — 0 si inactif. */
  assaultUntil: number;
  sprintUntil: number;
  shieldUntil: number;
}

export interface RemoteHex {
  id: string;
  owner: string;
  strength: number;
  tower: boolean;
}

/** MapSchema exposée par colyseus.js (accès défensif via forEach/get). */
export interface StateMap<T> {
  forEach(cb: (value: T, key: string) => void): void;
  get(key: string): T | undefined;
  size: number;
}

export interface RoomStateView {
  scope: string;
  players: StateMap<RemotePlayer>;
  hexes: StateMap<RemoteHex>;
}
