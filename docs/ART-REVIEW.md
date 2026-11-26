# G2-ART · Recette graphique et choix du moteur

## Lecture des captures

Le prototype G2 montrait une façade presque continue, trois repères discrets et toute la cour à l’écran. Sur mobile, le personnage et les labels perdaient en lisibilité. Les obstacles bloquaient bien la marche, mais la composition donnait peu d’indications visuelles pour les contourner. [Capture G2 ordinateur](../evidence/01-campus-desktop.png) · [Capture G2 mobile](../evidence/05-campus-mobile.png)

La cour retravaillée utilise trois accueils éclairés, un chemin pavé continu entre les stations, des ombres orientées et des reflets. Antoine garde sa veste bordeaux, son sweat blanc, son casque et son sac. Sa silhouette se détache davantage et l’alternance des bras et des jambes rend la marche lisible. Les trois stations et les deux jardinières restent aux mêmes coordonnées. Les 874 points échantillonnés du départ au dernier repère respectent les marges de déplacement. [Vue d’ensemble](../evidence/g2-r-g3/06-campus-vue-ensemble.png) · [Contrôle du tracé](../evidence/g2-r-g3/art-route.txt)

La caméra suit Antoine avec un cadrage 1,20× sur ordinateur et 1,64× quand le plateau mesure moins de 560 px. La vue d’ensemble et la préférence de réduction des animations donnent un cadre fixe à 1×. Le HUD conserve la direction du prochain repère quand il sort du cadre. Une pression sur son repère ouvre la mission uniquement à portée. La marche démarre progressivement et s’arrête au relâchement. [Capture ordinateur](../evidence/g2-r-g3/01-campus-desktop.png) · [Capture mobile](../evidence/g2-r-g3/05-campus-mobile.png)

Les droits de réutilisation des références photographiques du lycée restent à établir. Le décor visible est original et marqué **Campus provisoire**. La recette architecturale reste à faire. [Référence et droits](SOURCES.md#référence-visuelle-du-campus)

## Choix technique

| Solution | Apport pour la direction artistique | Incidence pour le prototype |
| --- | --- | --- |
| Phaser 3 · Canvas 2D | Caméra, atlas, composition manuelle de la lumière et lecture claire de la cour. | Retenu pour cette tranche. Le mode sans jeu reste séparé. Les lumières du décor sont peintes et les façades sont dans un seul plan. [Caméras Phaser](https://docs.phaser.io/phaser/concepts/cameras) |
| Phaser 3 · WebGL 2D ou PixiJS 8 | Textures, filtres et éclairage 2D par couches pour une parallaxe ou des effets dynamiques. | Le passage à WebGL dans Phaser permettrait de réutiliser le modèle et les interactions. PixiJS demanderait de reconnecter scène, caméra et contrôles. Comparaison qualitative à ce stade. [Phaser](https://docs.phaser.io/) · [PixiJS](https://pixijs.com/8.x/guides/getting-started/intro) |
| Godot 4 · 3D Web | Profondeur, éclairage et occultation géométriques dans une scène 3D. | Un essai demanderait des actifs 3D et une nouvelle intégration avec le parcours accessible. L’export Web demande WebAssembly et WebGL 2.0. [Export Web Godot](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) |

Le style urbain 2D reste cohérent avec la tranche et la navigation est mesurable. Une ambition de profondeur ou d’éclairage dynamique demanderait un essai comparatif WebGL sur le matériel cible. [Mesures et limites](G2-R-G3.md)
