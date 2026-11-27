# Cour fictive du démonstrateur P4

Le générateur construit une cour d’automne originale à l’échelle métrique. Il reprend le cadrage général d’ART-01 avec un érable au premier plan, des ailes de brique, une toiture d’ardoise et un portail central. La façade a des baies vitrées, des encadrements de calcaire, des gables, des corniches et des lanternes. Le mobilier et les plantations délimitent l’axe de circulation. Les ailes, la façade, le sol, les massifs, les bancs, les luminaires et les arbres restent des modules séparés.

## Source et droits

`campus.py` construit les maillages, les UV et les textures dans Blender. La brique, l’ardoise, les pavés et l’écorce proviennent de fonctions de couleur, de joints, de grain et de relief générées par ce script avec des graines fixes. Aucun fichier de texture ou maillage tiers, panneau officiel, logo, photographie du lycée ou pixel d’une planche conceptuelle n’est intégré au GLB. Le rapport d’autorisation et les références d’architecture du lycée restent dans le périmètre d’ART-03.

## Reproduire

Depuis la racine du dépôt avec Blender 4.3.2.

```sh
WATTEAU_CAMPUS_OUTPUT=/tmp/watteau-campus-source.glb \
  blender -b -t 2 --python-exit-code 1 --python experiments/artistic-slice/art/campus.py
```

La commande produit l’export Blender source. Le paquet Web Meshopt et ses empreintes figurent dans [l’inventaire livré](manifest.json). Les mesures ci-dessous concernent l’export Blender avant conditionnement. Le fichier glTF 2.0 binaire utilise Y comme axe vertical et fait face au +Z. Les matériaux utilisent les facteurs de rugosité et de métal PBR. Les quatre textures de couleur sont en JPEG et les quatre cartes de normales restent en PNG sans perte.

| Inventaire de l’export vérifié | Valeur |
|---|---:|
| Modules de maillage | 17 |
| Primitives avec UV et normales | 143 |
| Triangles | 51 205 |
| Matériaux | 31 |
| Textures intégrées | 8, dont 6 à 256 × 256 et 2 à 128 × 128 |
| Taille GLB brute | 3 638 460 octets |
| Taille locale gzip niveau 9 | 1 408 279 octets |
| SHA-256 | `26b0a46377a631fa7af66ed5a46afce85901ed08a56191a6a4afd23d05ee1054` |

Le rendu de précontrôle dans Chromium avec SwiftShader a permis d’inspecter le portail depuis le départ et à l’approche, la vue haute et la silhouette des arbres. Après le premier essai, les massifs de premier plan ont été rapprochés de l’axe pour encadrer la vue à 48°. Les contours de collision sont maintenus dans le modèle de déplacement de l’expérience. La taille gzip locale décrit seulement la compression du fichier et reste distincte du transfert constaté dans le navigateur.
