import colyseus from 'colyseus';
import { TerritoryRoom } from './rooms/TerritoryRoom.js';

const { Server } = colyseus;
const port = Number(process.env.PORT ?? 2567);

const gameServer = new Server();

// Une seule définition de room ; le scope (public/privé/événement) est porté par
// les options de jointure et le matchmaking filtre par metadata (code/eventId).
gameServer.define('territory', TerritoryRoom).filterBy(['scope', 'code', 'eventId']);

gameServer
  .listen(port)
  .then(() => console.log(`[game-server] Colyseus à l'écoute sur :${port}`))
  .catch((err) => {
    console.error('[game-server] échec du démarrage', err);
    process.exit(1);
  });
