import colyseus, { type Client } from 'colyseus';
import { polygonToCells } from 'h3-js';
import {
  ClientMessage,
  ENERGY_PER_METER,
  H3_RESOLUTION,
  LOOP_MAX_CELLS,
  MAX_ENERGY,
  MAX_SPEED_MPS,
  PLAYER_COLORS,
  POWER_EFFECT,
  ServerMessage,
  SIM_TICK_MS,
  type ClaimLoopMessage,
  type MoveMessage,
  type PowerMessage,
  type PowerResultEvent,
  type RedemptionIssuedEvent,
  type RoomJoinOptions,
} from '@pixirunner/protocol';
import { Player, TerritoryState } from './schema.js';
import { cellAt, haversineMeters } from '../game/geo.js';
import { verifyAccountToken } from '../auth.js';
import { claimNeutralCells, enterHex, maintain } from '../sim/combat.js';
import { applyPower, newTimers, type PowerTimers } from '../sim/energy.js';
import { sponsorSync } from '../sponsor/SponsorSync.js';

// Colyseus 0.15 est CommonJS : les classes runtime passent par l'export défaut.
const { Room } = colyseus;

interface LastPos {
  lat: number;
  lng: number;
  t: number;
}

/**
 * Room autoritaire de conquête de territoire : jointure, move (clamp + capture +
 * attrition + énergie), pouvoirs, et entretien du territoire (décroissance/régen).
 */
export class TerritoryRoom extends Room<TerritoryState> {
  maxClients = 64;

  private lastPos = new Map<string, LastPos>();
  private timers = new Map<string, PowerTimers>();
  /** Campagnes déjà récompensées par joueur (évite les doublons de bonus/redemption). */
  private rewarded = new Map<string, Set<string>>();
  private colorCursor = 0;

  onCreate(options: RoomJoinOptions): void {
    const scope = options?.scope ?? 'public';
    const state = new TerritoryState();
    state.scope = scope;
    this.setState(state);

    this.setMetadata({
      scope,
      code: options?.code ?? '',
      eventId: options?.eventId ?? '',
    });

    this.onMessage(ClientMessage.move, (client, msg: MoveMessage) =>
      this.handleMove(client, msg),
    );
    this.onMessage(ClientMessage.power, (client, msg: PowerMessage) =>
      this.handlePower(client, msg),
    );
    this.onMessage(ClientMessage.claimLoop, (client, msg: ClaimLoopMessage) =>
      this.handleClaimLoop(client, msg),
    );

    this.setSimulationInterval(() => this.tick(), SIM_TICK_MS);
  }

  onJoin(client: Client, options: RoomJoinOptions): void {
    const player = new Player();
    player.id = client.sessionId;
    let name = options?.name?.trim() ?? '';

    // Valide le JWT de compte (émis par le campaign-service) : sinon, invité.
    const account = options?.token ? verifyAccountToken(options.token) : null;
    if (account) {
      player.guest = false;
      player.accountId = account.sub;
      if (!name) name = account.name;
    } else {
      player.guest = true;
    }

    player.name = name || `Coureur-${client.sessionId.slice(0, 4)}`;
    player.colorIndex = this.colorCursor % PLAYER_COLORS.length;
    this.colorCursor += 1;
    this.state.players.set(client.sessionId, player);
    this.timers.set(client.sessionId, newTimers());
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.lastPos.delete(client.sessionId);
    this.timers.delete(client.sessionId);
    this.rewarded.delete(client.sessionId);
  }

  private handleMove(client: Client, msg: MoveMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !isFiniteLatLng(msg)) return;

    const now = Date.now();
    const timers = this.timers.get(client.sessionId);
    const sprinting = !!timers && timers.sprintUntil > now;
    const maxSpeed = MAX_SPEED_MPS * (sprinting ? POWER_EFFECT.sprintMultiplier : 1);

    const prev = this.lastPos.get(client.sessionId);
    if (prev) {
      const dt = (now - prev.t) / 1000;
      const dist = haversineMeters(prev.lat, prev.lng, msg.lat, msg.lng);
      if (dt > 0 && dist / dt > maxSpeed) return; // anti-triche
      player.energy = Math.min(MAX_ENERGY, player.energy + dist * ENERGY_PER_METER);
    }

    player.lat = msg.lat;
    player.lng = msg.lng;
    this.lastPos.set(client.sessionId, { lat: msg.lat, lng: msg.lng, t: now });

    const attritionMultiplier =
      timers && timers.assaultUntil > now ? POWER_EFFECT.assaultAttritionMultiplier : 1;
    const cell = cellAt(msg.lat, msg.lng);
    enterHex(this.state, player, cell, attritionMultiplier);
    this.maybeSponsorReward(client, player, cell);
  }

  /** Si la cellule conquise est sponsorisée : applique le bonus + émet la redemption. */
  private maybeSponsorReward(client: Client, player: Player, cell: string): void {
    const hex = this.state.hexes.get(cell);
    if (!hex || hex.owner !== player.id) return;
    const zone = sponsorSync.getZone(cell);
    if (!zone) return;

    let rewarded = this.rewarded.get(client.sessionId);
    if (!rewarded) {
      rewarded = new Set<string>();
      this.rewarded.set(client.sessionId, rewarded);
    }
    if (rewarded.has(zone.campaignId)) return;
    rewarded.add(zone.campaignId);

    player.energy = Math.min(MAX_ENERGY, player.energy + zone.energy);
    player.score += zone.score;

    const runnerRef = player.accountId || `guest:${client.sessionId}`;
    void sponsorSync
      .issueRedemption(runnerRef, zone.campaignId, zone.sponsorId, cell)
      .then((issued) => {
        if (!issued) return;
        const event: RedemptionIssuedEvent = {
          code: issued.code,
          offerId: zone.campaignId,
          sponsorId: zone.sponsorId,
          hexId: cell,
        };
        client.send(ServerMessage.redemptionIssued, event);
      });
  }

  private handlePower(client: Client, msg: PowerMessage): void {
    const player = this.state.players.get(client.sessionId);
    const timers = this.timers.get(client.sessionId);
    if (!player || !timers || !msg?.type) return;

    const cell = msg.targetHex ?? cellAt(player.lat, player.lng);
    const outcome = applyPower(this.state, player, cell, msg.type, timers, Date.now());
    const result: PowerResultEvent = {
      type: msg.type,
      ok: outcome.ok,
      reason: outcome.reason,
    };
    client.send(ServerMessage.powerResult, result);
  }

  private handleClaimLoop(client: Client, msg: ClaimLoopMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !msg?.polygon || msg.polygon.length < 4) return;

    const ring = msg.polygon.map((p) => [p.lat, p.lng] as [number, number]);
    let cells: string[];
    try {
      cells = polygonToCells(ring, H3_RESOLUTION);
    } catch {
      return; // polygone invalide
    }
    if (cells.length === 0 || cells.length > LOOP_MAX_CELLS) return;
    claimNeutralCells(this.state, player, cells, LOOP_MAX_CELLS);
  }

  private tick(): void {
    const now = Date.now();
    const shielded = new Set<string>();
    for (const [sid, t] of this.timers) {
      if (t.shieldUntil > now) shielded.add(sid);
    }
    maintain(this.state, shielded);
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
