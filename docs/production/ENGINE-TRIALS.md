# P3 · Essais comparés des moteurs

La campagne P3 évalue trois adaptateurs locaux pour une scène de démonstration sur campus fictif. Le moteur de production reste Phaser Canvas. Les fichiers de jeu, les visuels, les données, les tests historiques et le Harness V2 sont protégés par la référence existante. [Issue P3](https://github.com/darksathili-jpg/Watteau-horizon/issues/1) · [Méthode](ENGINE-TRIALS-METHOD.md)

## Configuration des démonstrateurs

Les candidats Three.js et Godot utilisent des volumes originaux aux mêmes coordonnées, un avatar provisoire d’environ 1,7 m, un cycle de marche, des variations de matériau et de lumière, trois repères et un cadrage de suivi à la troisième personne. Phaser Canvas sert de témoin expérimental en vue de dessus avec les mêmes limites, collisions, questions et déplacements. Le témoin de production reste la référence historique du Harness.

Les trois adaptateurs utilisent les mêmes contrôles et le même modèle de progression dans le shell expérimental. Les questions sont importées du module de mission existant. Le mode sans jeu est disponible directement sans chargement du moteur. Le stockage de l’essai, isolé par moteur, possède ses propres commandes de sauvegarde et d’effacement. Le parcours React, le carnet et le catalogue officiels restent dans le jeu de production.

Le cadrage, les trois positions de repères et la scène sont fixés avant mesure. Three.js et Godot partagent les dimensions des dalles, bâtiments, fenêtres, portes et bacs. La pose et l’articulation du personnage, les algorithmes d’ombre, les matériaux internes et le rendu des couleurs diffèrent. Le témoin Canvas présente une projection et une représentation du relief différentes. Les différences de cadence doivent être lues avec celles du contenu et de l’architecture des adaptateurs.

Des actifs procéduraux neutres constituent le décor. La géométrie et les matériaux ne reprennent aucune photographie du lycée. Les notices Three.js et Phaser sont produites au build et les licences de l’export Godot sont jointes au dossier Web. [Code et commandes](../../experiments/engine-trials/README.md) · [Grille de décision](../../experiments/engine-trials/decision-matrix.json)

La qualification reste liée aux appareils physiques et au contrat graphique approuvé. Les six revues Q8 restent indispensables à la diffusion élèves. [Protocole physique](ENGINE.md) · [Barrières du Harness](QUALITY.md)
