import './style.css';
import { api, clearToken, getToken, setToken } from './api.js';
import { MapCellPicker } from './mapPicker.js';

const root = document.getElementById('app')!;

function render(): void {
  root.innerHTML = '';
  if (getToken()) renderDashboard();
  else renderAuth();
}

// ── Auth ────────────────────────────────────────────────────────────────────

function renderAuth(): void {
  const card = el('div', 'card auth');
  card.innerHTML = `
    <h1>PixRunner · Commerçants</h1>
    <p class="muted">Créez des campagnes ciblant les quartiers que vos coureurs conquièrent.</p>
    <input id="email" type="email" placeholder="Email" />
    <input id="password" type="password" placeholder="Mot de passe" />
    <input id="name" type="text" placeholder="Nom du commerce (inscription)" />
    <div class="row">
      <button id="login" class="primary">Connexion</button>
      <button id="register">Inscription</button>
    </div>
    <div id="err" class="err"></div>`;
  root.appendChild(card);

  const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
  const err = (m: string) => (document.getElementById('err')!.textContent = m);

  document.getElementById('login')!.addEventListener('click', async () => {
    try {
      const r = await api.login(val('email'), val('password'));
      setToken(r.token);
      render();
    } catch (e) {
      err(String((e as Error).message));
    }
  });
  document.getElementById('register')!.addEventListener('click', async () => {
    try {
      const r = await api.register(val('email'), val('password'), val('name') || val('email'));
      setToken(r.token);
      render();
    } catch (e) {
      err(String((e as Error).message));
    }
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────

function renderDashboard(): void {
  const header = el('header', 'header');
  header.innerHTML = `<strong>PixRunner · Portail commerçant</strong>`;
  const logout = el('button', '') as HTMLButtonElement;
  logout.textContent = 'Déconnexion';
  logout.addEventListener('click', () => {
    clearToken();
    render();
  });
  header.appendChild(logout);
  root.appendChild(header);

  const grid = el('div', 'grid');
  root.appendChild(grid);

  // Colonne gauche : création (carte + formulaire).
  const left = el('div', 'card');
  left.innerHTML = `
    <h2>Nouvelle campagne</h2>
    <p class="muted">Cliquez la carte pour cibler des cellules (hexagones).</p>
    <div id="map" class="map"></div>
    <input id="title" placeholder="Titre (ex. -20% au Café)" />
    <div class="row">
      <select id="offerType">
        <option value="discount">Réduction</option>
        <option value="reward">Récompense</option>
        <option value="ad">Annonce</option>
      </select>
      <input id="offerValue" placeholder="Valeur (ex. -20%)" />
    </div>
    <div class="row">
      <input id="bonusEnergy" type="number" min="0" placeholder="Bonus énergie" value="10" />
      <input id="bonusScore" type="number" min="0" placeholder="Bonus score" value="2" />
    </div>
    <button id="create" class="primary">Créer la campagne</button>
    <div id="cerr" class="err"></div>`;
  grid.appendChild(left);

  const picker = new MapCellPicker(left.querySelector('#map') as HTMLElement);

  const right = el('div', 'card');
  right.innerHTML = `<h2>Mes campagnes</h2><div id="list" class="muted">…</div>
    <h2>Fréquentation (insights)</h2><div id="insights" class="muted">…</div>`;
  grid.appendChild(right);

  document.getElementById('create')!.addEventListener('click', async () => {
    const cerr = document.getElementById('cerr')!;
    const cells = picker.cells();
    if (cells.length === 0) {
      cerr.textContent = 'Sélectionnez au moins une cellule sur la carte.';
      return;
    }
    try {
      await api.createCampaign({
        title: v('title'),
        offerType: (document.getElementById('offerType') as HTMLSelectElement).value,
        offerValue: v('offerValue'),
        h3Cells: cells,
        bonusEnergy: Number(v('bonusEnergy')) || 0,
        bonusScore: Number(v('bonusScore')) || 0,
      });
      cerr.textContent = '';
      picker.clear();
      await refreshList();
    } catch (e) {
      cerr.textContent = String((e as Error).message);
    }
  });

  void refreshList();
  void refreshInsights();
}

async function refreshList(): Promise<void> {
  const list = document.getElementById('list');
  if (!list) return;
  try {
    const { campaigns } = await api.listCampaigns();
    list.innerHTML = campaigns.length ? '' : 'Aucune campagne.';
    for (const c of campaigns) {
      const row = el('div', 'item');
      row.innerHTML = `<span>${c.title} — ${c.offerValue} · ${c.h3Cells.length} cellules ${
        c.active ? '🟢' : '⚪️'
      }</span>`;
      const btn = document.createElement('button');
      btn.textContent = c.active ? 'Désactiver' : 'Activer';
      btn.addEventListener('click', async () => {
        await api.setActive(c.id, !c.active);
        await refreshList();
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  } catch (e) {
    list.textContent = String((e as Error).message);
  }
}

async function refreshInsights(): Promise<void> {
  const box = document.getElementById('insights');
  if (!box) return;
  try {
    const { cells } = await api.heatmap();
    box.innerHTML = cells.length ? '' : 'Aucune donnée de fréquentation.';
    for (const c of cells.slice(0, 20)) {
      box.appendChild(el('div', 'item', `${c.hexId} — ${c.visits} visites`));
    }
  } catch (e) {
    box.textContent = String((e as Error).message);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}
function v(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value.trim();
}

render();
