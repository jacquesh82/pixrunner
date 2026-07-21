/**
 * Types de jeu partagés : positions, état répliqué (miroir du schema Colyseus)
 * et messages client → serveur.
 */
import type { PowerType } from './constants.js';

/** Coordonnée géographique. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** État d'un joueur, répliqué à tous les clients de la room. */
export interface PlayerState {
  id: string;
  name: string;
  /** Index dans PLAYER_COLORS. */
  colorIndex: number;
  lat: number;
  lng: number;
  energy: number;
  score: number;
  /** true tant qu'aucun compte n'est lié (mode invité). */
  guest: boolean;
}

/** État d'un hexagone possédé, indexé par son id H3. */
export interface HexState {
  /** id H3 de la cellule. */
  id: string;
  /** id du joueur propriétaire, ou "" si neutre. */
  owner: string;
  /** Force courante (0..HEX_MAX_STRENGTH). */
  strength: number;
  /** true si l'hex est une balise/tour posée. */
  tower: boolean;
}

/** Portée d'une room. */
export type RoomScope = 'public' | 'private' | 'event';

/** Options passées à la création/jointure d'une room. */
export interface RoomJoinOptions {
  scope: RoomScope;
  /** Code d'invitation pour une room privée. */
  code?: string;
  /** id d'événement pour une room brandée. */
  eventId?: string;
  /** JWT du compte (absent en invité). */
  token?: string;
  /** Nom d'affichage. */
  name?: string;
}

// ── Messages client → serveur ──────────────────────────────────────────────

export interface MoveMessage {
  lat: number;
  lng: number;
  /** timestamp client (ms) — le serveur reste l'autorité. */
  t: number;
}

export interface PowerMessage {
  type: PowerType;
  /** Cible optionnelle : id H3 (fortify/tower) ou joueur. */
  targetHex?: string;
}

export interface ClaimLoopMessage {
  /** Polygone fermé décrit par la traînée du joueur. */
  polygon: LatLng[];
}

/** Nom des messages Colyseus (client → serveur). */
export const ClientMessage = {
  move: 'move',
  power: 'power',
  claimLoop: 'claimLoop',
} as const;

// ── Événements serveur → client (hors état répliqué) ────────────────────────

export interface RedemptionIssuedEvent {
  code: string;
  offerId: string;
  sponsorId: string;
  hexId: string;
}

export interface PowerResultEvent {
  type: PowerType;
  ok: boolean;
  reason?: string;
}

/** Nom des messages Colyseus (serveur → client). */
export const ServerMessage = {
  redemptionIssued: 'redemptionIssued',
  powerResult: 'powerResult',
} as const;
