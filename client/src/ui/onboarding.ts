const KEY = 'pixrunner.onboarded';

interface Slide {
  title: string;
  desc: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Conquiers ton quartier',
    desc: 'Cours ou marche : chaque hexagone que tu traverses devient ton territoire.',
  },
  {
    title: 'Défends et attaque',
    desc: "Traverse le territoire adverse pour l'affaiblir, et fortifie tes cœurs de zone.",
  },
  {
    title: 'Énergie & pouvoirs',
    desc: "Courir génère de l'énergie : déclenche Assaut, Sprint, Bouclier et plus encore.",
  },
];

/** Affiche l'onboarding au premier lancement puis demande la localisation. */
export function maybeOnboard(): Promise<void> {
  return new Promise((resolve) => {
    if (localStorage.getItem(KEY)) {
      resolve();
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'onboarding';
    const card = document.createElement('div');
    card.className = 'ob-card';
    const title = document.createElement('h2');
    const desc = document.createElement('p');
    const next = document.createElement('button');
    next.className = 'dock-btn primary';

    let i = 0;
    const render = (): void => {
      title.textContent = SLIDES[i].title;
      desc.textContent = SLIDES[i].desc;
      next.textContent = i < SLIDES.length - 1 ? 'Suivant' : 'Autoriser la localisation';
    };

    next.addEventListener('click', async () => {
      if (i < SLIDES.length - 1) {
        i += 1;
        render();
        return;
      }
      await requestGeolocationPermission();
      localStorage.setItem(KEY, '1');
      overlay.remove();
      resolve();
    });

    render();
    card.append(title, desc, next);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

function requestGeolocationPermission(): Promise<void> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) {
      res();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => res(),
      () => res(),
      { timeout: 8000 },
    );
  });
}
