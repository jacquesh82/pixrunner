import colyseus, { type Client } from 'colyseus';
import {
  ClientMessage,
  ENERGY_PER_METER,
  HEX_CAPTURE_STRENGTH,
  HEX_MAX_STRENGTH,
  MAX_ENERGY,
  MAX_SPEED_MPS,
  PLAYER_COLORS,
  SIM_TICK_MS,
  type MoveMessage,
  type RoomJoinOptions,
} from '@pixirunner/protocol';
import { Hex, Player, TerritoryState } from './schema.js';
import { cellAt, haversineMeters } from '../game/geo.js';

// Colyseus 0.15 est CommonJS : les classes runtime passent par l'export défaut.
const { Room } = colyseus;

interface LastPos {
  lat: number;
  lng: number;
  t: number;
}

/**
 * Room autoritaire de conquête de territoire.
 * Tâche A2 : jointure, `move` (clamp de vitesse + capture d'hex neutre + énergie), rooms.
 * Le combat complet (attrition/forteresse/pouvoirs) est ajouté en tâche A6.
 */
export class TerritoryRoom extends Room<TerritoryState> {
  maxClients = 64;

  /** Dernière position connue par client (non répliquée) — sert au clamp de vitesse. */
  private lastPos = new Map<string, LastPos>();
  /** Compteur pour attribuer des couleurs distinctes. */
  private colorCursor = 0;

  onCreate(options: RoomJoinOptions): void {
    const scope = options?.scope ?? 'public';
    const state = new TerritoryState();
    state.scope = scope;
    this.setState(state);

    // Matchmaking : rooms publiques partagées, privées/événement filtrées par code/eventId.
    this.setMetadata({
      scope,
      code: options?.code ?? '',
      eventId: options?.eventId ?? '',
    });

    this.onMessage(ClientMessage.move, (client, msg: MoveMessage) =>
      this.handleMove(client, msg),
    );

    this.setSimulationInterval(() => this.tick(), SIM_TICK_MS);
  }

  onJoin(client: Client, options: RoomJoinOptions): void {
    const player = new Player();
    player.id = client.sessionId;
    player.name = options?.name?.trim() || `Coureur-${client.sessionId.slice(0, 4)}`;
    player.colorIndex = this.colorCursor % PLAYER_COLORS.length;
    player.guest = !options?.token;
    this.colorCursor += 1;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    // Le territoire conquis persiste après le départ (il décroîtra faute de défense).
    this.state.players.delete(client.sessionId);
    this.lastPos.delete(client.sessionId);
  }

  private handleMove(client: Client, msg: MoveMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !isFiniteLatLng(msg)) return;

    const now = Date.now();
    const prev = this.lastPos.get(client.sessionId);
    if (prev) {
      const dt = (now - prev.t) / 1000;
      const dist = haversineMeters(prev.lat, prev.lng, msg.lat, msg.lng);
      // Anti-triche : rejette un déplacement plus rapide que la vitesse plausible.
      if (dt > 0 && dist / dt > MAX_SPEED_MPS) return;
      player.energy = Math.min(MAX_ENERGY, player.energy + dist * ENERGY_PER_METER);
    }

    player.lat = msg.lat;
    player.lng = msg.lng;
    this.lastPos.set(client.sessionId, { lat: msg.lat, lng: msg.lng, t: now });

    this.captureAt(player, msg.lat, msg.lng);
  }

  /** Capture/renforce l'hexagone sous le joueur (neutre → possédé). */
  private captureAt(player: Player, lat: number, lng: number): void {
    const cell = cellAt(lat, lng);
    let hex = this.state.hexes.get(cell);
    if (!hex) {
      hex = new Hex();
      hex.id = cell;
      this.state.hexes.set(cell, hex);
    }
    if (hex.owner === '') {
      hex.owner = player.id;
      hex.strength = HEX_CAPTURE_STRENGTH;
      player.score += 1;
    } else if (hex.owner === player.id) {
      hex.strength = Math.min(HEX_MAX_STRENGTH, hex.strength + 1);
    }
    // Hex ennemi : l'attrition est gérée en tâche A6.
  }

  /** Boucle de simulation — la décroissance/régénération arrive en tâche A6. */
  private tick(): void {
    // Placeholder : maintenu pour la tâche A6 (combat/entretien du territoire).
  }
}

function isFiniteLatLng(msg: MoveMessage): boolean {
  return (
    Number.isFinite(msg.lat) &&
    Number.isFinite(msg.lng) &&
    Math.abs(msg.lat) <= 90 &&
    Math.abs(msg.lng) <= 180
  );
}
