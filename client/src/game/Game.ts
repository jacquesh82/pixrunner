import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PixiOverlay } from '../map/PixiOverlay.js';
import { GameClient } from '../net/GameClient.js';
import { Avatars } from '../players/Avatars.js';
import { HexLayer } from '../layers/HexLayer.js';
import { getGuestIdentity } from '../net/identity.js';
import { buildDock, setInputLabel, setStatus } from '../ui/dock.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM, LIGHT_STYLE } from '../map/style.js';
import { KeyboardSource } from '../input/KeyboardSource.js';
import { GeolocationSource } from '../input/GeolocationSource.js';
import type { InputKind, Position, PositionSource } from '../input/PositionSource.js';
import type { RoomStateView } from './types.js';

/**
 * Orchestrateur du shell hybride : carte MapLibre montée en permanence, overlay
 * Pixi synchronisé, connexion invité, input clavier/GPS, suivi caméra, avatars.
 */
export class Game {
  private overlay = new PixiOverlay();
  private client: GameClient;
  private avatars!: Avatars;
  private hexes!: HexLayer;
  private map!: MapLibreMap;
  private lastState?: RoomStateView;

  private source?: PositionSource;
  private inputKind: InputKind = 'keyboard';
  private follow = true;
  private centeredOnSelf = false;

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

    this.hexes = new HexLayer(this.overlay, this.map);
    this.avatars = new Avatars(this.overlay, () => this.client.sessionId);

    // Panner à la main désactive le suivi ; « Recentrer » le réactive.
    this.map.on('dragstart', () => {
      this.follow = false;
    });

    buildDock(this.root, {
      onRecenter: () => {
        this.follow = true;
        this.recenterOnSelf();
      },
      onToggleInput: () => this.toggleInput(),
    });
    this.client.onStatus = (s) => setStatus(s);
    this.client.onState = (state) => this.onState(state);

    const { name } = getGuestIdentity();
    await this.client.join({ scope: 'public', name });

    // Spawn initial au centre de la carte, puis démarrage de l'input continu.
    const c = this.map.getCenter();
    this.client.sendMove(c.lat, c.lng);
    this.startInput('keyboard');
  }

  private onState(state: RoomStateView): void {
    this.lastState = state;
    this.hexes.sync(state);
    this.avatars.sync(state);
    if (!this.centeredOnSelf) this.recenterOnSelf();
  }

  private startInput(kind: InputKind): void {
    this.source?.stop();
    this.inputKind = kind;
    const start = this.selfPos() ?? mapCenter(this.map);

    if (kind === 'keyboard') {
      this.source = new KeyboardSource(start);
    } else {
      const gps = new GeolocationSource();
      gps.onError = (m) => setStatus(m);
      this.source = gps;
    }
    this.source.start((pos) => this.onLocalPosition(pos));
    setInputLabel(kind === 'keyboard' ? 'Clavier' : 'GPS');
  }

  private toggleInput(): void {
    this.startInput(this.inputKind === 'keyboard' ? 'gps' : 'keyboard');
  }

  private onLocalPosition(pos: Position): void {
    this.client.sendMove(pos.lat, pos.lng);
    if (this.follow) this.map.setCenter([pos.lng, pos.lat]);
  }

  private recenterOnSelf(): void {
    const me = this.selfPos();
    if (!me) return;
    this.map.easeTo({ center: [me.lng, me.lat], duration: 400 });
    this.centeredOnSelf = true;
  }

  private selfPos(): Position | undefined {
    const id = this.client.sessionId;
    if (!id) return undefined;
    const me = this.lastState?.players.get(id);
    return me ? { lat: me.lat, lng: me.lng } : undefined;
  }
}

function mapCenter(map: MapLibreMap): Position {
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng };
}
