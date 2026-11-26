# Audit et référence de travail

## Référence observée le 26 novembre 2026

Le checkout local était propre et `main` pointait localement et sur GitHub vers `b7c673172ca7102aca6e019668530da16c74f816`. Le run de ce commit avait réussi. La nouvelle exécution locale a confirmé le build, 28 tests Vitest et 9 scénarios Chromium, avec zéro violation axe signalée sur les cinq surfaces auditées. [Contrôle GitHub de référence](https://github.com/darksathili-jpg/Watteau-horizon/actions/runs/45743318984)

L’audit couvre le parcours clavier et tactile, les trois étapes de mission, le mode sans jeu, les poses et collisions, le carnet, le catalogue Parcoursup audité et les ressources du campus fictif. Le manifeste fige la révision, les empreintes des trois visuels et l’inventaire des neuf fichiers contenant la recette et sa configuration. Le diff depuis la référence sur `src/`, `public/`, `data/`, `tests/`, l’entrée HTML et les configurations de build et de navigateur est vide. [Manifeste](../../production/baseline.json)

Le dépôt contenait une recette CI et un workflow Pages manuel. GitHub a depuis activé Pages en mode Actions. L’adresse signalée répond en HTTP 200 lors d’une lecture seule. La modification du harness et les vérifications CI ne déclenchent aucun déploiement. [Workflow de prévisualisation](../../.github/workflows/preview.yml)

## État initial des contrôles et décisions

- Les spécifications existantes restent les références produit, données et design. Le nouvel index décrit les responsabilités, critères et preuves. [Référentiel](README.md)
- Q1 à Q7 sont passées lors du premier essai du harness. Les cinq captures de référence et de travail ont les mêmes dimensions et 0 pixel différent. La vérification s’appuie sur des builds fraîchement produits dans le même environnement.
- Q8 est bloquée. Les droits du visuel définitif, la validation manuelle d’accessibilité, les mesures physiques, la revue de la campagne et des licences, la revue de confidentialité et l’autorisation institutionnelle doivent être attestés pour le commit livré. [Pièces attendues](QUALITY.md#pièces-de-revue)
- La cartographie Parcoursup 2026 reste le périmètre du comparateur existant. La mise à disposition élèves exige une validation de la campagne effectivement visée. [Registre de provenance](../SOURCES.md#catalogue-parcoursup)
- L’évaluation 3D est au stade du protocole. Les essais physiques et la sélection d’un moteur restent à réaliser. [Protocole](ENGINE.md)

## Exécution sur le commit du harness

Le commit `fbb01aa` a passé les contrôles GitHub Actions. Le run a archivé les journaux, les captures et les comparaisons sous `controles-watteau-horizon`. [Exécution vérifiée](https://github.com/darksathili-jpg/Watteau-horizon/actions/runs/45765699303)

Deux recettes locales ont utilisé le même checkout propre et Chromium 156.0.8078.79. Les deux ont produit Q1 à Q7 en PASS et Q8 en BLOCKED. Le profil développement est sorti avec le code 0. Le profil élèves sans attestation est sorti avec le code 1, après avoir exécuté les contrôles indépendants. Chaque recette a exécuté 28 tests Vitest, 9 scénarios Chromium et 6 tests propres au harness. npm audit a remonté zéro vulnérabilité. [Résultats structurés](../../evidence/harness-v2/receipt.json) · [Codes de sortie](../../evidence/harness-v2/profiles.txt)

Les cinq scénarios graphiques ont donné 0 pixel modifié sur 6 591 300 pixels comparés. Sur un worktree d’essai, un changement volontaire de couleur du bandeau d’en-tête a déclenché Q3, une sortie 1 et des différences sur les cinq scènes. Le worktree de recette a été retiré après le test. Le contrôle de paquet a rejeté un build normal et accepté un build marqué prévisualisation.

Le JavaScript du jeu représente 396439 octets gzip. Le comparateur représente 3915 octets gzip. L’intervalle p95 d’image de deux passages Chromium locaux a varié entre 16,8 et 50 ms. Ces mesures sur hôte de développement restent distinctes de la recette physique du futur protocole 3D.
