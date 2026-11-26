# Essais moteur P3 · Watteau Horizon

Ces démonstrateurs utilisent un campus fictif original, trois repères et un avatar provisoire. Le code de jeu expérimental mutualise les coordonnées, les collisions, le déplacement, les questions existantes, le carnet local et les contrôles. Phaser Canvas montre le terrain en vue de dessus. Les adaptateurs Three.js et Godot Web suivent le personnage à la troisième personne.

## Construire et ouvrir localement

Depuis le dépôt, avec Node.js 24 et npm :

```sh
npm ci
npm --prefix experiments/engine-trials ci
npm --prefix experiments/engine-trials test
npm --prefix experiments/engine-trials run build
GODOT_WEB_TEMPLATE_ZIP=/chemin/web_nothreads_release.zip \
  tools/engine-trials/export-godot.sh experiments/engine-trials/dist
node tools/engine-trials/serve.mjs experiments/engine-trials/dist 4174
```

L’export utilise Godot 4.7.2 stable et le modèle Web officiel monothread. Le script fixe la version et vérifie l’empreinte de l’archive extraite. Le dossier `dist/` est local et séparé du build du jeu. Les autres moteurs et le parcours sans jeu restent utilisables si l’export Godot manque. Lance l’adresse locale affichée par le serveur et choisis un moteur. Ajoute `&mode=accessible` à une adresse comportant déjà `?engine=three` pour ouvrir directement le parcours sans rendu.

## Reproduire les mesures

```sh
npx playwright install chromium ffmpeg
node tools/engine-trials/benchmark.mjs --video --out quality-results/p3
```

Le benchmark exige un nouveau dossier de preuve. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de pointer vers un Chromium installé. La commande de diagnostic `--smoke --case three-desktop` utilise une répétition et trois secondes de mouvement. L’exécution complète utilise les minima du protocole et enregistre séparément les vidéos.

Les commandes et résultats détaillés sont dans le [rapport P3](../../docs/production/ENGINE-TRIALS.md). La [grille de décision](decision-matrix.json) maintient la migration en attente. Les notices de licence Three.js, Phaser et Godot sont jointes aux fichiers construits.
