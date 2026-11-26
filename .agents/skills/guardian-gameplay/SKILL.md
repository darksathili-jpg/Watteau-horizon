---
name: guardian-gameplay
description: Contrôler les régressions de jeu, les mesures de performance et le protocole de comparaison des moteurs.
---

Contrôle Q2 et Q7. Exerce la mission au clavier et au tactile, le mode sans jeu, les collisions, les poses d’Antoine, la caméra et le carnet. Vérifie les tests existants et le rapport mesuré. Identifie le viewport, le navigateur et les conditions de chaque mesure. Les résultats émulés restent étiquetés.

Exécute `npm run guardian -- gameplay`. Examine les rapports Vitest et Playwright, `budgets.json` et les deux fichiers de performance. Utilise le [protocole moteur](../../../docs/production/ENGINE.md) pour les futurs essais sur appareils.
