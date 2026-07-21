import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PixiOverlay } from '../map/PixiOverlay.js';
import { GameClient } from '../net/GameClient.js';
import { Avatars } from '../players/Avatars.js';
import { getGuestIdentity } from '../net/identity.js';
import { buildDock, setStatus } from '../ui/dock.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM, LIGHT_STYLE } from '../map/style.js';
import type { RoomStateView } from './types.js';

/**
 * Orchestrateur du shell hybride : carte MapLibre montée en permanence, overlay
 * Pixi synchronisé, connexion à la room en invité, rendu des avatars.
 * L'input continu (clavier/GPS) et le rendu des couches arrivent aux tâches A4+.
 */
export class Game {
  private overlay = new PixiOverlay();
  private client: GameClient;
  private avatars!: Avatars;
  private map!: MapLibreMap;
  private centeredOnSelf = false;
  private lastState?: RoomStateView;

  constructor(
    private root: HTMLElement,
    gameUrl: string,
  ) {
    this.client = new GameClient(gameUrl);
  }

  async start(): Promise<void> {
    const mapEl = document.createElement('div');
    mapEl.id = 'map';
    this.root.appendChild(mapEl);

    this.map = new maplibregl.Map({
      container: mapEl,
      style: LIGHT_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    await this.map.once('load');
    await this.overlay.init(this.map, mapEl);

    this.avatars = new Avatars(this.overlay, () => this.client.sessionId);

    buildDock(this.root, { onRecenter: () => this.recenterOnSelf() });
    this.client.onStatus = (s) => setStatus(s);
    this.client.onState = (state) => this.onState(state);

    const { name } = getGuestIdentity();
    await this.client.join({ scope: 'public', name });

    // Spawn initial : place le joueur au centre courant (l'input continu = tâche A4).
    const c = this.map.getCenter();
    this.client.sendMove(c.lat, c.lng);
  }

  private onState(state: RoomStateView): void {
    this.lastState = state;
    this.avatars.sync(state);
    if (!this.centeredOnSelf) this.recenterOnSelf(state);
  }

  private recenterOnSelf(state?: RoomStateView): void {
    const id = this.client.sessionId;
    if (!id) return;
    const me = (state ?? this.lastState)?.players.get(id);
    if (!me) return;
    this.map.easeTo({ center: [me.lng, me.lat], duration: 400 });
    this.centeredOnSelf = true;
  }
}
