# PixRunner

Jeu de **conquête de territoire IRL** en temps réel : le joueur court/marche dans la vraie vie et
conquiert du territoire sur une vraie carte, rendu en **PixiJS**. Gratuit pour le coureur, financé par
une couche commerciale (zones sponsorisées, événements brandés, freemium cosmétique, insights).

## Architecture — projets indépendants + contrat partagé

| Projet | Rôle | Stack |
|--------|------|-------|
| `protocol/` | Contrat partagé (types messages, état, constantes) — zéro dép runtime | TypeScript pur |
| `game-server/` | Backend jeu autoritaire temps réel (rooms, combat, énergie) | Colyseus + h3-js |
| `client/` | App coureur (web → Android) | Vite + PixiJS + MapLibre + colyseus.js |
| `campaign-service/` | Backend commercial (auth, campagnes, redemptions, billing) | REST + Postgres/Prisma + Stripe |
| `merchant-portal/` | Portail commerçant (campagnes, dashboards) | Vite + MapLibre |

Chaque brique est **déployable seule** et ne partage que le contrat `protocol/`. Le client ne connaît
ses backends que par variables d'environnement (`VITE_GAME_URL`, `VITE_CAMPAIGN_URL`).

## Concept de jeu

- **Grille de territoire H3** (grille hexagonale géographique réelle), autorité serveur.
- **3 couches simultanées** : brouillard (exploration), hexagones (propriété fine), boucle (capture d'un
  quartier neutre en fermant une boucle).
- **Combat** : chaque hex a une **force** ; les cœurs entourés d'alliés sont fortifiés, les bordures
  faibles. On attaque en traversant l'hex ennemi ; le territoire non défendu décroît.
- **Énergie & pouvoirs** : courir génère de l'énergie, dépensée en pouvoirs (Assaut, Fortification,
  Tour, Sprint, Bouclier).

## Développement

```bash
npm install                 # installe les workspaces existants
npm run typecheck           # typecheck tous les projets
npm run dev:game            # game-server (Colyseus)
npm run dev:client          # client (Vite)
```

Le plan détaillé et le séquençage par phases vivent dans le suivi de tâches du projet.
