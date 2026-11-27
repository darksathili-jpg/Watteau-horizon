# Sources des personnages P4

Les personnages ont été créés dans Blender 4.3.2 pour le démonstrateur. Le générateur emploie une topologie anatomique et des cibles morphologiques MPFB sous CC0 1.0. Les deux visages résultent de réglages morphologiques distincts. Les vêtements et leurs plis, la coiffure, les chaussures, le sac, les textures, l’armature et les animations sont construits dans `characters.py` avec des paramètres propres à chacun. Le portrait est un rendu Blender du maillage Antoine exporté pour le démonstrateur. Les planches individuelles ART-02 servent de références de proportions et de couleurs. [Conditions officielles de MPFB et MakeHuman](https://www.makehumancommunity.org/about/license.html) · [Données MPFB au commit épinglé](https://github.com/makehumancommunity/mpfb2/tree/d9648f3257a0b9712281d466245f30d656250154/src/mpfb/data)

| Source archivée dans `makehuman-cc0/` | Empreinte SHA-256 de vérification |
| --- | --- |
| `base.obj.gz` | `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c` après décompression |
| `african-male-young.target.gz` | `05ed84d6df36e788cdfa8da0be15376850524b960cf2f17f3e592b9cf7d21c85` |
| `asian-male-young.target.gz` | `0928ed8b9f08f60afb9884cf9e9f33a939ed3a85d7f136de9ccc88a76981d6d7` |
| `caucasian-male-young.target.gz` | `ffe69537e53148edff2776204ba48cf3bf1f3cbc72966592c8a562ab80b07333` |
| `head-oval.target.gz` | `057eea7c5535c325493b9107228052b03c78fac1bcb24905313fae6351179cb8` |
| `head-square.target.gz` | `94b484ae145970e5368706d4f42711f50e18fcbf7d9f1ee800572c3fa69f855a` |
| `nose-point-width-incr.target.gz` | `bf5f782b014675be57aba4c840261308cc0d408660ecdfd22a42d47a756a016c` |

Le maillage OBJ provient du dossier `3dobjs`. Les cibles viennent des sous-dossiers `targets/macrodetails`, `targets/head` et `targets/nose`. Le fichier OBJ précise que la dédicace CC0 date de septembre 2020. La licence amont distingue ces fichiers de données du code de l’extension MPFB. Le générateur utilise Blender et les fichiers ci-dessus. [Licence des données dans le commit](https://github.com/makehumancommunity/mpfb2/blob/d9648f3257a0b9712281d466245f30d656250154/LICENSE.ASSETS.md) · [Licence à deux volets](https://github.com/makehumancommunity/mpfb2/blob/d9648f3257a0b9712281d466245f30d656250154/LICENSE.md) · [OBJ source](https://github.com/makehumancommunity/mpfb2/blob/d9648f3257a0b9712281d466245f30d656250154/src/mpfb/data/3dobjs/base.obj)

## Reconstruction

```sh
blender -b -t 6 --python-exit-code 1 \
  --python experiments/artistic-slice/art/characters.py -- \
  --previews /tmp/watteau-personnages --blend-dir /tmp/watteau-sources-blender
```

Le générateur vérifie l’intégrité des entrées, produit les GLB source à la destination par défaut `experiments/artistic-slice/public/assets/` et rend le portrait WebP du modèle Antoine. L’option `--assets` permet un export isolé pour reconstruire sans remplacer les paquets Web éventuellement optimisés dans ce dossier. `--previews` et `--blend-dir` sont facultatives et produisent les vues ateliers et les scènes Blender éditables. Les couleurs des matériaux, les UV et les textures sont générées et intégrées dans les GLB.

En glTF, l’axe vertical est +Y, l’avant +Z, et le plan des semelles au repos est à Y = 0. Un squelette par personnage porte les six actions `Idle`, `Walk`, `Run`, `Turn`, `Interact` et `Dialogue`. Les cycles sont joués sur place. Le déplacement du monde et les transitions sont gérés par le démonstrateur. La jambe d’appui est construite à partir d’une cible de cheville, puis le bassin, les bras et la tête complètent le mouvement. La comparaison avec les planches et la revue du mouvement sur les appareils cibles restent dans la recette P4.

## Contrôle des semelles et des clips exportés

```sh
blender -b -t 6 --python-exit-code 1 \
  --python experiments/artistic-slice/art/characters.py -- \
  --assets /tmp/watteau-glb-verification --skip-portrait
blender -b --python-exit-code 1 \
  --python experiments/artistic-slice/art/character-contact.py -- \
  /tmp/watteau-glb-verification
```

Le contrôle inspecte les primitives glTF, impose la présence des UV, normales, indices et poids de peau, vérifie la somme des poids et évalue les semelles à 91 instants par clip. À chaque instant, il applique les clés STEP ou LINEAR, les rotations et les matrices d’inversion de pose de liaison. Le plus bas des sommets de semelle sélectionnés est comparé au plan Y = 0. Le contrôle porte sur les GLB Blender avant compression Web. [Mesures par clip](character-contact.json)

| GLB source | Triangles | Hauteur au repos | Os | Matériaux et images |
| --- | ---: | ---: | ---: | --- |
| Avatar | 52 638 | 1,726 m | 19 | 24 matériaux, 25 images intégrées |
| Antoine | 52 634 | 1,748 m | 19 | 24 matériaux, 25 images intégrées |

Les semelles sont à 0 m au repos. L’échantillonnage révèle jusqu’à 7,7 mm de pénétration sous le plan en marche et 6,8 mm en course. L’appui reste continu en marche et la phase aérienne de course atteint environ 13 mm aux semelles. Les deux GLB portent 57 canaux par clip et sept matériaux utilisent une carte normale. Les durées exportées de marche et de course sont 1,033 s et 0,767 s. Les vitesses nominales sur la phase d’appui approchent 1,05 m/s et 2,31 m/s à la cadence 1×. Le glissement dans le jeu dépend du déplacement du contrôleur et de la transition entre clips.
