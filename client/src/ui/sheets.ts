/** Feuille modale (bottom-sheet) générique par-dessus la carte live. */

export function openSheet(
  title: string,
  build: (body: HTMLElement) => void,
): void {
  closeSheet();

  const backdrop = document.createElement('div');
  backdrop.id = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.id = 'sheet';

  const head = document.createElement('div');
  head.className = 'sheet-head';
  const h = document.createElement('h3');
  h.textContent = title;
  const close = document.createElement('button');
  close.className = 'dock-btn';
  close.textContent = 'Fermer';
  close.addEventListener('click', closeSheet);
  head.append(h, close);

  const body = document.createElement('div');
  body.className = 'sheet-body';
  build(body);

  sheet.append(head, body);
  backdrop.appendChild(sheet);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet();
  });
  document.body.appendChild(backdrop);
}

export function closeSheet(): void {
  document.getElementById('sheet-backdrop')?.remove();
}
