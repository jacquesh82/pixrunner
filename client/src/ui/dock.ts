/**
 * Dock hybride + bandeau de statut : actions par-dessus la carte live.
 * Les feuilles modales méta (Sélection de partie, Empire, etc.) arrivent en tâche A7.
 */
export interface DockHandlers {
  onPlay?: () => void;
  onRecenter: () => void;
  onToggleInput: () => void;
}

export function buildDock(root: HTMLElement, handlers: DockHandlers): void {
  const status = document.createElement('div');
  status.id = 'status';
  status.textContent = '…';
  root.appendChild(status);

  const dock = document.createElement('div');
  dock.id = 'dock';

  const play = makeButton('Jouer', 'primary');
  play.addEventListener('click', () => handlers.onPlay?.());

  const input = makeButton('Clavier');
  input.id = 'input-btn';
  input.addEventListener('click', () => handlers.onToggleInput());

  const recenter = makeButton('Recentrer');
  recenter.addEventListener('click', () => handlers.onRecenter());

  dock.append(play, input, recenter);
  root.appendChild(dock);
}

export function setStatus(text: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

export function setInputLabel(label: string): void {
  const el = document.getElementById('input-btn');
  if (el) el.textContent = label;
}

function makeButton(label: string, variant?: 'primary'): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = variant ? `dock-btn ${variant}` : 'dock-btn';
  b.textContent = label;
  return b;
}
