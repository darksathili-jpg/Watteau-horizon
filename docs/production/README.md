# Référentiel de production V2

Le harness vérifie le jeu et le comparateur avant toute évolution du rendu. Il s’appuie sur la révision Git `b7c673172ca7102aca6e019668530da16c74f816`, livrée après G2-R, G3 et G2-ART. Les références graphiques actuelles sont celles du campus fictif et du prototype. Les maquettes et droits destinés à une version définitive restent à établir.

## Consulter les spécifications

| Sujet | Document |
| --- | --- |
| Public, mission, orientation et parcours sans jeu | [Produit](../PRODUCT.md) |
| Contraintes de rendu, périmètre des actifs et droits | [Direction artistique](../DESIGN.md), [audit du campus](../ART-REVIEW.md) |
| Architecture et contrat d’import | [Architecture](../ARCHITECTURE.md), [données](../DATA.md), [registre des sources](../SOURCES.md) |
| Critères historiques et preuves de référence | [Recette](../ACCEPTANCE.md), [G1/G2](../PROOFS.md), [G2-R/G3/G2-ART](../G2-R-G3.md) |
| Guardians, profils, barrières et attestation | [Contrôles de production](QUALITY.md) |
| Environnement et méthode de capture | [Comparaison graphique](VISUAL.md) |
| Hypothèses, mesure, seuils proposés et décision 3D | [Protocole expérimental](ENGINE.md) |
| Situation constatée et preuves du harness | [Audit et exécution](AUDIT.md), [suivi des lots](../../PLANS.md) |

## Exécuter

```sh
npm ci
npx playwright install chromium
npm run quality
```

Node.js 24, Git avec l’historique de la référence et `tar` sont requis. Sur Linux sans dépendances Chromium, utilise `npx playwright install --with-deps chromium`. Le registre npm est nécessaire à l’audit et le navigateur doit pouvoir accéder au serveur local de recette. La variable `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de pointer vers un Chromium déjà installé. La version effective est enregistrée.

Chaque exécution crée son propre dossier dans `quality-results/`. Fournir `--out <nouveau-dossier>` permet de choisir la destination. Le rapport Markdown résume les barrières et le JSON donne le résultat et la preuve de chaque contrôle. GitHub Actions archive le dossier du harness et les traces de tests en cas d’échec.
