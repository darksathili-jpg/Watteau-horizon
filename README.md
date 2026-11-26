# Watteau Horizon

Prototype web d’orientation post-bac pour le projet du lycée Watteau de Valenciennes. La mission **Le relais numérique** fait découvrir trois activités par une mise en situation jouable et un parcours sans jeu qui partagent la même progression.

## Essayer le prototype

Avec Node.js 24 et npm, depuis ce dossier :

```sh
npm ci
npm run dev
```

Ouvre l’adresse locale affichée par Vite. En mode jeu, place le focus dans la zone du campus, utilise les flèches pour te déplacer et Entrée pour ouvrir l’étape à proximité. Sur écran tactile, maintiens les flèches sous le campus. À portée, le repère s’ouvre aussi d’une pression sur la carte. Le bouton **Vue d’ensemble** fixe le cadre. Le bouton **Sans jeu** donne accès aux mêmes étapes. Le carnet permet d’enregistrer une réflexion, de l’exporter et d’effacer les données locales.

## Vérifier le projet

```sh
npm test
npm run build
npm run check:static
npm run catalogue:check
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=moderate
```

Les tests navigateur servent la compilation à l’adresse locale `/Watteau-horizon/` pour vérifier les chemins d’un projet GitHub Pages. Pour utiliser un Chromium installé, renseigne `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. La variable `WATTEAU_EVIDENCE_DIR` enregistre les captures et les mesures. Le résultat de `npm run build` se trouve dans `dist/`, qui contient les fichiers statiques et les mentions des dépendances distribuées.

## Périmètre

Le campus et Antoine sont fictifs. Les visuels originaux livrés dans `public/art/` sont reproductibles avec `python tools/generate-art.py` et Pillow 13.0.0. La photo et le logo du lycée nécessitent une autorisation de réutilisation. Le comparateur présente un extrait vérifié de 16 offres Parcoursup 2026 liées au numérique dans quatre communes du Valenciennois. Les données, la couverture et les licences figurent dans le registre. Les notes, la position et les étapes sont conservées dans le navigateur.

- [État des lots](PLANS.md)
- [Registre des sources et des droits](docs/SOURCES.md)
- [Recette G2-R, G3 et G2-ART](docs/G2-R-G3.md)
- [Audit graphique](docs/ART-REVIEW.md)
- [Recette initiale G1/G2](docs/PROOFS.md)

## Prévisualisation de développement

La compilation `VITE_WATTEAU_PREVIEW=1 npm run build` affiche le bandeau de prévisualisation. Le workflow GitHub Actions **Prévisualisation de développement** est manuel et réserve le déploiement à `main` après les contrôles. L’état d’activation de GitHub Pages figure dans le journal de recette.
