# Cour d’automne · démonstrateur P4

Cette expérience Three.js présente un campus fictif et deux personnages jouables ou interactifs. Le parcours reprend les trois étapes du Relais numérique, le carnet et les 16 offres Parcoursup vérifiées du prototype. Les sauvegardes P4 utilisent une clé locale distincte. Le réglage « Sans jeu » permet de parcourir les mêmes étapes sans charger de moteur 3D.

## Démarrer depuis les sources

Depuis la racine, avec Node 24.

```sh
npm ci
npm ci --prefix experiments/artistic-slice
npm run build --prefix experiments/artistic-slice
node tools/artistic-slice/serve.mjs
```

Ouvrir `http://127.0.0.1:4175/watteau-p4/`. Sur ordinateur, utiliser les flèches ou ZQSD, Maj pour courir et Entrée à portée d’une destination. Sur mobile, maintenir les boutons de déplacement. L’application ouvre le parcours sans jeu si le contexte graphique ou un modèle échoue. L’accès direct ajoute `?mode=accessible` à l’adresse. Le menu permet de réduire le mouvement, y compris le lissage de la caméra et les gestes secondaires.

## Sources 3D et conditionnement

[Campus, textures et droits](art/CAMPUS.md) · [Personnages et entrées CC0](art/CHARACTER-SOURCES.md) · [Inventaire GLB livré](art/manifest.json)

```sh
mkdir -p /tmp/watteau-p4-blender
WATTEAU_CAMPUS_OUTPUT=/tmp/watteau-p4-blender/campus.glb \
  blender -b -t 2 --python-exit-code 1 --python experiments/artistic-slice/art/campus.py
blender -b -t 2 --python-exit-code 1 --python experiments/artistic-slice/art/characters.py -- \
  --assets /tmp/watteau-p4-blender --blend-dir /tmp/watteau-p4-blender
node experiments/artistic-slice/art/pack.mjs /tmp/watteau-p4-blender /tmp/watteau-p4-web
```

Le conditionnement conserve la topologie, les textures intégrées et les six clips. Il réordonne les indices et quantifie les attributs avec Meshopt à 16 bits pour les positions et à 12 bits pour les normales et poids. Les UV hors de l’intervalle unitaire restent tels quels pour les textures répétées. Les GLB de `public/assets/` sont les fichiers Web conditionnés. Les générateurs produisent la forme source dans Blender 4.3.2. Le portrait provient de la scène d’Antoine. Pour régénérer le manifeste après une modification acceptée, placer les paquets vérifiés dans `public/assets/`, puis lancer `node experiments/artistic-slice/art/inventory.mjs --write`.

Le décodeur Meshopt WebAssembly est fourni par la dépendance Three.js épinglée. La CSP P4 autorise le WebAssembly de cette version sans autoriser `unsafe-eval` pour JavaScript. Les URL `blob:` servent au décodage local des textures GLB. Le serveur de recette impose une origine locale et bloque l’encadrement de sa page. Le parcours sans jeu démarre sans ces modules. Le mode `?instrument=1` expose les seules observations du rendu pour la recette de développement.

## Recette

```sh
npm run quality
npm run quality:students
node tools/artistic-slice/run.mjs /tmp/watteau-p4-recette
```

Le profil artistique produit son propre rapport. Il applique à P4 les seuils de performance comparatifs du protocole P3 et mesure cinq départs à froid et 60 secondes de mouvement par profil. Les tests historiques et Q8 restent sous le contrôle du Harness V2. Les captures et les rapports sont référencés dans le [journal P4](../../docs/P4-ARTISTIC-SLICE.md).
