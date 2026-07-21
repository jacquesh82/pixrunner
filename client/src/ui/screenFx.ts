/**
 * Effets plein écran : pulsation colorée aux bords (vignette) jouée à
 * l'activation d'un pouvoir. Signal instantané, même si l'effet sur la carte
 * se déclenche hors du champ de vision.
 */

let el: HTMLDivElement | null = null;

function ensureEl(): HTMLDivElement {
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-vignette';
    document.body.appendChild(el);
  }
  return el;
}

/** Pulse les bords de l'écran dans la couleur du pouvoir. */
export function flashVignette(color: number): void {
  const node = ensureEl();
  node.style.setProperty('--fx-color', `#${color.toString(16).padStart(6, '0')}`);
  node.classList.remove('flash');
  void node.offsetWidth; // force un reflow → relance l'animation
  node.classList.add('flash');
}
