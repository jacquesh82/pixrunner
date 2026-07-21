import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Offer, RoomScope } from '@pixirunner/protocol';
import { PixiOverlay } from '../map/PixiOverlay.js';
import { GameClient } from '../net/GameClient.js';
import { CampaignClient, type CosmeticItem } from '../net/CampaignClient.js';
import { AccountClient } from '../net/AccountClient.js';
import { Avatars } from '../players/Avatars.js';
import { HexLayer, setHexHighContrast } from '../layers/HexLayer.js';
import { LoopLayer } from '../layers/LoopLayer.js';
import { FogLayer } from '../layers/FogLayer.js';
import { getGuestIdentity } from '../net/identity.js';
import { buildDock, setInputLabel, setStatus } from '../ui/dock.js';
import { buildHud, updateHud } from '../ui/hud.js';
import { maybeOnboard } from '../ui/onboarding.js';
import { closeSheet, openSheet } from '../ui/sheets.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM, LIGHT_STYLE } from '../map/style.js';
import { KeyboardSource } from '../input/KeyboardSource.js';
import { GeolocationSource } from '../input/GeolocationSource.js';
import type { InputKind, Position, PositionSource } from '../input/PositionSource.js';
import type { RemotePlayer, RoomStateView } from './types.js';

const HC_KEY = 'pixrunner.highContrast';

/** Orchestrateur du shell hybride : carte + overlay Pixi, couches, input, HUD, sheets. */
export class Game {
  private overlay = new PixiOverlay();
  private client: GameClient;
  private avatars!: Avatars;
  private hexes!: HexLayer;
  private loop!: LoopLayer;
  private fog!: FogLayer;
  private map!: MapLibreMap;
  private lastState?: RoomStateView;

  private source?: PositionSource;
  private inputKind: InputKind = 'keyboard';
  private follow = true;
  private centeredOnSelf = false;

  private campaign: CampaignClient;
  private account: AccountClient;
  private offers = new Map<string, Offer>();
  private wallet: Array<{ code: string; title: string; value: string }> = [];
  private catalog: CosmeticItem[] = [];

  constructor(
    private root: HTMLElement,
    gameUrl: string,
    campaignUrl: string,
  ) {
    this.client = new GameClient(gameUrl);
    this.campaign = new CampaignClient(campaignUrl);
    this.account = new AccountClient(campaignUrl);
  }

  private authOptions(scope: RoomScope, code?: string) {
    const token = this.account.getToken() ?? undefined;
    return { scope, code, name: getGuestIdentity().name, token };
  }

  private applyEquipped(): void {
    const av = localStorage.getItem('pixrunner.skin.avatar');
    const tr = localStorage.getItem('pixrunner.skin.trail');
    const avItem = this.catalog.find((c) => c.sku === av);
    const trItem = this.catalog.find((c) => c.sku === tr);
    if (avItem) this.avatars.setSelfColor(avItem.color);
    if (trItem) this.loop.setColor(trItem.color);
  }

  async start(): Promise<void> {
    await maybeOnboard();

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
    // Attend le chargement de la carte, avec filet de sécurité : si l'onglet est
    // en arrière-plan (rAF throttlé), 'load' peut ne jamais arriver → on continue
    // après un court délai, la projection fonctionne dès que le style est prêt.
    await new Promise<void>((resolve) => {
      if (this.map.loaded()) {
        resolve();
        return;
      }
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        resolve();
      };
      this.map.once('load', finish);
      window.setTimeout(finish, 3000);
    });
    await this.overlay.init(this.map, mapEl);

    const center = mapCenter(this.map);
    this.fog = new FogLayer(this.overlay, center);
    this.hexes = new HexLayer(this.overlay, this.map);
    this.loop = new LoopLayer(this.overlay, (polygon) => this.client.sendClaimLoop(polygon));
    this.avatars = new Avatars(this.overlay, () => this.client.sessionId);

    this.map.on('dragstart', () => {
      this.follow = false;
    });

    buildDock(this.root, {
      onPlay: () => this.openSelectionSheet(),
      onMenu: () => this.openMenuSheet(),
      onRecenter: () => {
        this.follow = true;
        this.recenterOnSelf();
      },
      onToggleInput: () => this.toggleInput(),
    });
    buildHud(this.root, { onPower: (type) => this.client.sendPower(type) });

    // Applique le mode haut-contraste mémorisé.
    setHexHighContrast(localStorage.getItem(HC_KEY) === '1');

    this.client.onStatus = (s) => setStatus(s);
    this.client.onState = (state) => this.onState(state);
    this.client.onPowerResult = (r) =>
      setStatus(r.ok ? `pouvoir ${r.type} activé` : `pouvoir refusé : ${r.reason ?? ''}`);
    this.client.onRedemption = (e) => this.onRedemption(e.offerId, e.code);

    // Charge les zones sponsorisées → mise en avant + offres.
    void this.campaign.fetchSponsoredZones().then(({ cells, offers }) => {
      this.offers = offers;
      this.hexes.setSponsored(cells);
    });
    // Catalogue cosmétique + application des skins équipés.
    void this.campaign.fetchCatalog().then((c) => {
      this.catalog = c;
      this.applyEquipped();
    });

    await this.client.join(this.authOptions('public'));
    this.spawnAndStartInput();
  }

  private spawnAndStartInput(): void {
    const c = mapCenter(this.map);
    this.client.sendMove(c.lat, c.lng);
    this.centeredOnSelf = false;
    this.startInput(this.inputKind);
  }

  private onState(state: RoomStateView): void {
    this.lastState = state;
    this.hexes.sync(state);
    this.avatars.sync(state);
    const id = this.client.sessionId;
    const me = id ? state.players.get(id) : undefined;
    if (me) updateHud({ energy: me.energy, score: me.score });
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
    this.fog.reveal(pos);
    this.loop.addPoint(pos);
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

  // ── Feuilles modales ──────────────────────────────────────────────────────

  private openSelectionSheet(): void {
    openSheet('Sélection de partie', (body) => {
      const join = async (scope: RoomScope, code?: string): Promise<void> => {
        closeSheet();
        setStatus('changement de room…');
        this.loop.reset();
        await this.client.switchRoom(this.authOptions(scope, code));
        this.spawnAndStartInput();
      };

      const pub = actionButton('Carte publique', () => void join('public'));

      const codeInput = document.createElement('input');
      codeInput.placeholder = "Code d'invitation";
      codeInput.className = 'sheet-input';
      const priv = actionButton('Rejoindre une room privée', () =>
        void join('private', codeInput.value.trim() || undefined),
      );

      body.append(pub, codeInput, priv);
    });
  }

  private onRedemption(offerId: string, code: string): void {
    const offer = this.offers.get(offerId);
    this.wallet.push({
      code,
      title: offer?.title ?? 'Offre',
      value: offer?.value ?? '',
    });
    setStatus(`🎁 offre débloquée : ${offer?.title ?? ''} (${code})`);
  }

  private openMenuSheet(): void {
    openSheet('Menu', (body) => {
      body.append(
        actionButton(`Offres débloquées (${this.wallet.length})`, () => this.openWalletSheet()),
        actionButton('Boutique cosmétique', () => this.openShopSheet()),
        actionButton('Mon empire', () => this.openEmpireSheet()),
        actionButton('Classements', () => this.openLeaderboardSheet()),
        actionButton('Profil', () => this.openProfileSheet()),
        actionButton('Réglages', () => this.openSettingsSheet()),
      );
    });
  }

  /** Portefeuille d'offres = résumé post-course (offres/récompenses + codes). */
  private openWalletSheet(): void {
    openSheet('Offres débloquées', (body) => {
      if (this.wallet.length === 0) {
        body.append(line('Aucune offre pour le moment — conquiers une zone sponsorisée (halo doré) !'));
        return;
      }
      for (const w of this.wallet) {
        body.append(line(`${w.title} ${w.value} — code ${w.code}`));
      }
    });
  }

  private openEmpireSheet(): void {
    openSheet('Mon empire', (body) => {
      const id = this.client.sessionId;
      let hexes = 0;
      this.lastState?.hexes.forEach((h) => {
        if (id && h.owner === id) hexes += 1;
      });
      const me = id ? this.lastState?.players.get(id) : undefined;
      body.append(
        line(`Territoire (score) : ${me?.score ?? 0}`),
        line(`Hexagones possédés : ${hexes}`),
      );
    });
  }

  private openLeaderboardSheet(): void {
    openSheet('Classements', (body) => {
      const players: RemotePlayer[] = [];
      this.lastState?.players.forEach((p) => players.push(p));
      players.sort((a, b) => b.score - a.score);
      if (players.length === 0) body.append(line('Aucun joueur.'));
      players.forEach((p, i) => body.append(line(`${i + 1}. ${p.name} — ${p.score}`)));
    });
  }

  private openProfileSheet(): void {
    openSheet('Profil', (body) => {
      const { guestId, name } = getGuestIdentity();
      body.append(line(`Nom : ${name}`));
      if (this.account.isLoggedIn()) {
        body.append(line('Mode : compte connecté'));
        body.append(
          actionButton('Se déconnecter', () => {
            this.account.logout();
            closeSheet();
            setStatus('déconnecté du compte');
          }),
        );
      } else {
        body.append(line('Mode : invité'), line(`ID : ${guestId.slice(0, 8)}`));
        body.append(
          actionButton('Créer un compte / se connecter', () => this.openAccountGate(() => {})),
        );
      }
    });
  }

  private async openShopSheet(): Promise<void> {
    const token = this.account.getToken();
    const owned = token ? await this.campaign.fetchOwned(token) : new Set<string>();
    openSheet('Boutique cosmétique', (body) => {
      if (this.catalog.length === 0) {
        body.append(line('Catalogue indisponible (campaign-service hors ligne ?).'));
        return;
      }
      for (const item of this.catalog) {
        const row = document.createElement('div');
        row.className = 'sheet-toggle';
        const label = document.createElement('span');
        label.textContent = `${item.name} · ${(item.priceCents / 100).toFixed(2)} €`;
        row.appendChild(label);
        const btn = document.createElement('button');
        btn.className = owned.has(item.sku) ? 'dock-btn' : 'dock-btn primary';
        btn.textContent = owned.has(item.sku) ? 'Équiper' : 'Acheter';
        btn.addEventListener('click', () =>
          owned.has(item.sku) ? this.equip(item) : void this.purchase(item),
        );
        row.appendChild(btn);
        body.appendChild(row);
      }
      if (!this.account.isLoggedIn()) {
        body.append(line('Créez un compte pour acheter et conserver vos cosmétiques.'));
      }
    });
  }

  private equip(item: CosmeticItem): void {
    localStorage.setItem(
      item.kind === 'avatar' ? 'pixrunner.skin.avatar' : 'pixrunner.skin.trail',
      item.sku,
    );
    this.applyEquipped();
    setStatus(`${item.name} équipé`);
    closeSheet();
  }

  private async purchase(item: CosmeticItem): Promise<void> {
    if (!this.account.isLoggedIn()) {
      this.openAccountGate(() => void this.purchase(item));
      return;
    }
    const ok = await this.campaign.claim(this.account.getToken()!, item.sku);
    if (ok) this.equip(item);
    else setStatus('achat impossible');
  }

  /** Gate de création de compte (upgrade invité → compte, migre l'identité). */
  private openAccountGate(onDone: () => void): void {
    openSheet('Créer un compte / se connecter', (body) => {
      const email = inputField('email', 'Email');
      const pass = inputField('password', 'Mot de passe');
      const err = line('');

      const doAuth = async (mode: 'login' | 'register'): Promise<void> => {
        try {
          if (mode === 'register') {
            await this.account.register(email.value.trim(), pass.value, getGuestIdentity().name);
          } else {
            await this.account.login(email.value.trim(), pass.value);
          }
          // Reconnexion avec le token → le serveur passe le joueur en compte.
          this.loop.reset();
          await this.client.switchRoom(this.authOptions('public'));
          this.spawnAndStartInput();
          closeSheet();
          setStatus('connecté à ton compte');
          onDone();
        } catch (e) {
          err.textContent = String((e as Error).message);
        }
      };

      body.append(
        email,
        pass,
        actionButton('Connexion', () => void doAuth('login')),
        actionButton('Inscription', () => void doAuth('register')),
        actionButton('Continuer avec Google', () => {
          window.location.href = this.account.oidcStartUrl('google');
        }),
        actionButton('Continuer avec Mindlog.id', () => {
          window.location.href = this.account.oidcStartUrl('mindlog');
        }),
        err,
      );
    });
  }

  private openSettingsSheet(): void {
    openSheet('Réglages', (body) => {
      body.append(
        toggleRow('Mode extérieur (haut contraste)', localStorage.getItem(HC_KEY) === '1', (on) => {
          localStorage.setItem(HC_KEY, on ? '1' : '0');
          setHexHighContrast(on);
          document.body.classList.toggle('high-contrast', on);
        }),
        toggleRow(
          'Partager mes données de fréquentation (anonymisé)',
          localStorage.getItem('pixrunner.dataOptIn') === '1',
          (on) => localStorage.setItem('pixrunner.dataOptIn', on ? '1' : '0'),
        ),
      );
    });
  }
}

function mapCenter(map: MapLibreMap): Position {
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng };
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'dock-btn sheet-action';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function line(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'sheet-line';
  d.textContent = text;
  return d;
}

function inputField(type: string, placeholder: string): HTMLInputElement {
  const i = document.createElement('input');
  i.type = type;
  i.placeholder = placeholder;
  i.className = 'sheet-input';
  return i;
}

function toggleRow(label: string, initial: boolean, onChange: (on: boolean) => void): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'sheet-toggle';
  const span = document.createElement('span');
  span.textContent = label;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = initial;
  cb.addEventListener('change', () => onChange(cb.checked));
  row.append(span, cb);
  return row;
}
