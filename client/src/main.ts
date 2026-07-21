import './style.css';
import { Game } from './game/Game.js';

const gameUrl = import.meta.env.VITE_GAME_URL ?? 'ws://localhost:2567';
const campaignUrl = import.meta.env.VITE_CAMPAIGN_URL ?? 'http://localhost:3001';
const root = document.getElementById('app');

if (!root) {
  throw new Error('#app introuvable');
}

const game = new Game(root, gameUrl, campaignUrl);
if (import.meta.env.DEV) {
  // Poignée de debug (dev uniquement).
  (window as unknown as { __game: Game }).__game = game;
}
game.start().catch((err) => {
  console.error('[client] échec du démarrage', err);
});
