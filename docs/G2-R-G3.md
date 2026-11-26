# Recette G2-R, G3 et G2-ART

Vérifications réalisées le 26 novembre 2026 sous Linux avec Node.js 24.22.3, npm 11.19.1 et Chromium 156.0.8078.79.

## Synchronisation et GitHub Actions

Le dépôt distant partait de `5efafdc`. Cette révision était ancêtre des deux commits locaux. Git a avancé `main` sans forcer le push. Les commits `89caf36` et `d9b43e5` se retrouvent sur la branche distante. Le workflow d’origine, déclenché sur `d9b43e5`, a réussi. [Recette d’origine sur GitHub](https://github.com/darksathili-jpg/Watteau-horizon/actions/runs/45741759535)

Le commit `1a3e8ad` prépare un workflow Pages manuel qui ne déploie qu’à partir de `main`, après les contrôles. La compilation de prévisualisation porte un bandeau distinct et une directive `noindex, nofollow`. Le commit `05d0f4d` ajoute le catalogue et la nouvelle version du campus. Son workflow GitHub s’est terminé avec succès, y compris Playwright sur Chromium installé par le runner et l’archivage des preuves. [Contrôles de la livraison](https://github.com/darksathili-jpg/Watteau-horizon/actions/runs/45742964888)

## Prévisualisation GitHub Pages

Le 26 novembre 2026, GitHub a renvoyé `has_pages: false`. L’appel de configuration en mode Actions a reçu HTTP 403 `Resource not accessible by integration`. Le déclenchement manuel du workflow a réussi. Les contrôles et la fabrication de l’artefact ont abouti. Le déploiement a ensuite reçu HTTP 404 de GitHub, qui demande l’activation de Pages. Le workflow et le paquet statique sont prêts. L’adresse reste indisponible tant qu’un administrateur du dépôt ne choisit pas **GitHub Actions** comme source dans les paramètres Pages. [Workflow manuel](https://github.com/darksathili-jpg/Watteau-horizon/actions/runs/45742966391) · [Journal GitHub](../evidence/g2-r-g3/github.txt)

## Catalogue et comparateur

Le comparateur permet de sélectionner deux offres différentes dans un extrait de 16 formations de la campagne 2026, à Valenciennes, Anzin, Aulnoy-lez-Valenciennes et Famars. L’import rejouable hors ligne vérifie le manifeste, l’empreinte, le schéma et le périmètre avant de générer le catalogue. Le build échoue si son artefact ne correspond plus à l’archive. La sélection représente 16 offres sur 129 lignes toutes filières confondues dans ces quatre communes. Une fiche officielle et la provenance par champ sont accessibles pour chacune.

Les 16 fiches Parcoursup ont répondu au contrôle de collecte. La licence Etalab 2.0 et la date de traitement sont affichées dans le comparateur. Trois lignes signalent l’apprentissage et la source laisse les durées inconnues. L’export Idéo a répondu et sa licence ODbL 1.0 a été vérifiée. L’extrait utilise la seule cartographie Parcoursup, la jointure Idéo et les obligations de redistribution d’une base adaptée restent à instruire. [Sources, limites et commandes](SOURCES.md#catalogue-parcoursup)

## Résultats locaux

| Contrôle | Résultat observé |
| --- | --- |
| `npm ci --no-fund --no-audit`, `npm audit --audit-level=moderate` | 51 dépendances installées, 0 vulnérabilité signalée. |
| `VITE_WATTEAU_PREVIEW=1 npm run build`, `npm run check:static` | Contrôle du catalogue, TypeScript et compilation réussis. Ressources relatives, CSP, consigne aux indexeurs et absence de données synthétiques dans le build. |
| `npm run catalogue:import`, `npm run catalogue:check` | 16 offres acceptées, aucune quarantaine ni formation sélectionnée manquante. L’artefact régénéré a la même empreinte SHA-256. |
| `npm test` | 28 tests réussis, dont 13 pour le nouvel import officiel et 3 pour le guidage et la caméra. |
| `WATTEAU_EXPECT_PREVIEW=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium WATTEAU_EVIDENCE_DIR=evidence/g2-r-g3 npm run test:e2e` | 9 scénarios réussis. Contrôles de la mission, du carnet, de l’animation et des collisions conservés. Ajout du cadrage, du clic sur le repère à portée et du comparateur avec provenance et valeurs inconnues. Aucune erreur JS ou HTTP, ni écriture ou requête réseau externe dans les parcours. |
| Axe | 0 violation relevée sur les cinq vues contrôlées et dans le comparateur avec deux fiches et une provenance ouverte, selon les règles automatisées WCAG 2/2.1 A et AA couvertes. |
| `python tools/generate-art.py` | Trois visuels régénérés à l’identique. Les 16 poses sont distinctes, transparentes et alignées au pixel d’appui 63. |

Le premier passage navigateur a repéré une assertion ambiguë sur le titre « Durée indicative », présent à la fois dans la comparaison et dans le détail de provenance. L’assertion finale vérifie la ligne Durée et sa valeur manquante dans la fiche affichée. Le contrôle visuel a aussi motivé le déplacement du badge de la scène sur mobile et le masquage des labels coupés par les bords de la caméra.

[Installation et audit](../evidence/g2-r-g3/dependencies.txt) · [Build et tests unitaires](../evidence/g2-r-g3/checks.txt) · [Recette navigateur](../evidence/g2-r-g3/browser.txt)

## Captures et mesures

- Campus et commandes. [Ordinateur](../evidence/g2-r-g3/01-campus-desktop.png) · [Mobile](../evidence/g2-r-g3/05-campus-mobile.png) · [Vue d’ensemble](../evidence/g2-r-g3/06-campus-vue-ensemble.png)
- Parcours de la mission. [Dialogue](../evidence/g2-r-g3/02-dialogue-mission.png) · [Sans jeu](../evidence/g2-r-g3/03-parcours-sans-jeu.png) · [Carnet](../evidence/g2-r-g3/04-carnet.png)
- Comparateur avec deux offres réelles. [Ordinateur](../evidence/g2-r-g3/07-comparateur-desktop.png) · [Mobile](../evidence/g2-r-g3/08-comparateur-mobile.png)

Sur ordinateur à 1440 × 960, la scène était prête 320 ms après le passage du mode sans jeu au mode jeu. Pendant 90 images avec une touche de déplacement maintenue, le 95e centile de l’intervalle entre images était de 16,7 ms et aucun intervalle n’a dépassé 32 ms. Phaser a rapporté environ 61 images/s. Sur mobile tactile émulé à 390 × 844, la navigation initiale jusqu’à la scène a pris 679 ms et Phaser a rapporté environ 60 images/s. Les chronométrages couvrent des étapes différentes. [Mesure ordinateur](../evidence/g2-r-g3/performance.json) · [Mesure mobile émulé](../evidence/g2-r-g3/performance-mobile.json)

Vite signale le volume du module Phaser, environ 1,20 Mo minifié et 320 ko gzip. Le comparateur représente environ 56 ko minifiés et 4 ko gzip dans un module chargé à l’ouverture de l’onglet. L’équipement des lycéens, le chargement sur leur réseau et une recette avec des personnes restent à mesurer. La fidélité architecturale du campus fictif reste à valider avec des références autorisées. [Audit graphique et alternatives moteur](ART-REVIEW.md)
