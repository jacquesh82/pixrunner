import { Client } from 'colyseus.js';
import type { Room } from 'colyseus.js';
import {
  ClientMessage,
  ServerMessage,
  type MoveMessage,
  type PowerMessage,
  type PowerResultEvent,
  type PowerType,
  type RoomJoinOptions,
} from '@pixirunner/protocol';
import type { RoomStateView } from '../game/types.js';

/**
 * Connexion au game-server (Colyseus). Le client n'est jamais autoritaire :
 * il envoie ses intentions (move/power/claimLoop) et affiche l'état reçu.
 */
export class GameClient {
  private client: Client;
  private room?: Room;

  onState?: (state: RoomStateView) => void;
  onStatus?: (status: string) => void;
  onPowerResult?: (result: PowerResultEvent) => void;

  constructor(gameUrl: string) {
    this.client = new Client(gameUrl);
  }

  async join(options: RoomJoinOptions): Promise<void> {
    this.onStatus?.('connexion…');
    this.room = await this.client.joinOrCreate('territory', options);
    this.onStatus?.(`connecté · room ${options.scope}`);
    this.room.onStateChange((state) =>
      this.onState?.(state as unknown as RoomStateView),
    );
    this.room.onMessage(ServerMessage.powerResult, (result: PowerResultEvent) =>
      this.onPowerResult?.(result),
    );
    this.room.onError((code, message) =>
      this.onStatus?.(`erreur ${code} ${message ?? ''}`),
    );
    this.room.onLeave(() => this.onStatus?.('déconnecté'));
  }

  get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  sendMove(lat: number, lng: number): void {
    if (!this.room) return;
    const msg: MoveMessage = { lat, lng, t: Date.now() };
    this.room.send(ClientMessage.move, msg);
  }

  sendPower(type: PowerType): void {
    if (!this.room) return;
    const msg: PowerMessage = { type };
    this.room.send(ClientMessage.power, msg);
  }
}
