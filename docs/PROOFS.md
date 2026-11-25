# Journal de vérification du prototype G1 et G2

Recette du 25 novembre 2026 sur Linux, Node.js 24.22.3, npm 11.19.1 et Chromium 156.0.8078.79. La branche locale `main` part de `5efafdc`. Le commit `89caf36` contient le code, les tests, les visuels et le registre des sources. Le commit suivant consigne cette recette et les captures.

## Livrables

- **G1** — Application statique Vite, React et TypeScript strict. Phaser 3 avec rendu Canvas charge la scène à la demande. Le mode sans jeu fonctionne dans React et ne charge pas Phaser. Les chemins relatifs ont été exercés sur la compilation montée sous `/Watteau-horizon/`.
- **G2 provisoire** — Antoine et les trois étapes du *Relais numérique*, commandes clavier et tactiles, obstacles et poses d’animation. Le mode sans jeu utilise les mêmes situations et la même progression. Le carnet sépare la réflexion de la réussite de la mission. La sauvegarde locale permet la reprise, l’export et l’effacement. Le comparateur affiche son indisponibilité pendant la validation du catalogue.
- **Sources** — Sept familles de sources officielles recensées, dont la cartographie Parcoursup et les statistiques de campagne, avec licences, schémas et écarts observés. L’import vérifie le manifeste, le SHA-256, la provenance par champ, les valeurs manquantes, les contradictions, les doublons et les jointures sur un jeu synthétique. Deux formations sur huit sont acceptées. [Registre des sources](SOURCES.md)
- **Visuels** — Campus WebP de 960 × 540 px, portrait d’Antoine et atlas PNG à quatre directions. La génération avec Pillow 13.0.0 reproduit les trois empreintes. Les 16 poses ont un fond transparent et un appui commun. Le libellé « Campus provisoire » est visible dans les captures.

## Résultats réels

| Commande | Résultat |
| --- | --- |
| `npm ci --no-fund --no-audit` | 51 paquets installés depuis le lockfile. |
| `npm run build` | TypeScript et compilation Vite réussis. La sortie contient les mentions de licence des dépendances distribuées. |
| `npm run check:static` | Chemins relatifs, images, CSP, réglage du referrer et absence du jeu synthétique dans les fichiers client contrôlés. |
| `npm test` | 12 tests réussis sur le domaine, le carnet, la géométrie du campus et l’import de données. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium WATTEAU_EVIDENCE_DIR=evidence npm run test:e2e` | 7 scénarios réussis. Parcours clavier complet, reprise de la position et des étapes, mode sans jeu, carnet et export, stockage bloqué, animation, collision, tactile et mesure. Aucune erreur JS ou HTTP, ni requête sortante ou écriture réseau durant ces scénarios. |
| `npm audit --audit-level=moderate` | 0 vulnérabilité signalée par npm au moment de la recette. |
| `python tools/generate-art.py` | Les empreintes de l’atlas, du portrait et du campus sont identiques avant et après régénération. |
| Lecture de `.github/workflows/checks.yml` par PyYAML | Structure valide, actions épinglées et permission `contents: read`. Le workflow exécute les contrôles et archive les preuves. Son exécution GitHub reste à vérifier. |

L’audit axe a signalé 0 violation sur cinq surfaces, selon les règles automatisées WCAG 2/2.1 A et AA testées. Le campus a 24 règles applicables réussies, le mode sans jeu 23, le dialogue 17, le carnet 22 et les formations 22. [Sortie Playwright](../evidence/browser.txt)

Sorties archivées pour [l’installation et npm audit](../evidence/dependencies.txt), [le build, les tests unitaires et les visuels](../evidence/checks.txt), [les tests navigateur](../evidence/browser.txt) et [la mesure performance](../evidence/performance.json).

## Captures

- [Campus sur ordinateur, 1440 × 960](../evidence/01-campus-desktop.png)
- [Dialogue de la première étape](../evidence/02-dialogue-mission.png)
- [Parcours sans jeu](../evidence/03-parcours-sans-jeu.png)
- [Carnet avec une note synthétique](../evidence/04-carnet.png)
- [Campus sur mobile tactile émulé, 390 × 844](../evidence/05-campus-mobile.png)

## Anomalies et limites

- Le premier passage Playwright a exposé deux défauts dans les scénarios. Le parcours clavier omettait la sélection initiale avec Espace. Le test de pose échantillonnait une marche trop courte juste avant la jardinière. Les assertions vérifient désormais la sélection clavier, la progression de l’animation en terrain libre et le retour à la pose au repos lors de la collision.
- Le service de prévisualisation de l’environnement a échoué à l’ouverture du port local avec `EPERM`. Les tests et captures ont été réalisés sur la compilation statique via le serveur temporaire de Playwright.
- Sur Chromium headless à 1440 × 960 en local, la scène était prête 382 ms après l’activation du mode jeu. Phaser a rapporté 61 images/s sur le premier échantillon de 60 images. Le module jeu pèse environ 1,20 Mo minifié et 320 ko gzip dans le rapport Vite. Vite signale sa taille. Les mesures sur le matériel des lycéens et sur la connexion de l’établissement restent à réaliser.
- Les autorisations pour la photographie et le logo du lycée, la comparaison architecturale et la recette institutionnelle restent à établir. Le jeu utilise uniquement le décor fictif et les visuels originaux inclus dans le prototype.
- G3 attend les exports datés, les validations de schéma sur données réelles et la vérification des jointures. Les résultats de la simulation illustrent le mécanisme d’import et le comparateur reste indisponible.
