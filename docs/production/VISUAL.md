# Comparaison graphique reproductible

La référence est le commit immuable indiqué dans [le manifeste](../../production/baseline.json). Elle contient le campus fictif, le personnage et le parcours de démonstration validés techniquement. Les ressources et captures historiques restent dans leur état d’origine.

`npm run guardian -- art` extrait le commit par `git archive`, compile la référence dans un dossier temporaire et compile la version de travail. Les deux compilations utilisent le même lockfile lorsqu’il est identique. Sinon le harness installe celui de la référence dans son dossier isolé. Les pages sont servies en local sous le même préfixe de projet GitHub Pages, sur des ports distincts.

Un même navigateur prend cinq paires de captures en français, en thème sombre et avec un contexte neuf par scène. L’environnement utilise un facteur d’échelle de 1, des viewports fixés à 1440 × 960 et 390 × 844, les mêmes polices système pour les deux versions et un rendu sans animation CSS pendant la capture. Les scènes couvrent le campus sur ordinateur et mobile émulé, le mode sans jeu, et le comparateur de deux offres sur les deux formats. Les captures attendent le chargement de la vue et des polices.

Les fichiers `*-reference.png`, `*-candidate.png` et `*-diff.png` sont générés sous `visual/`. Les pixels modifiés sont en rose dans les cartes de différence. Le JSON enregistre navigateur, dimensions et nombre de pixels différents. Un défaut de dimension ou un seul pixel modifié déclenche Q3. Les résultats se comparent à l’intérieur d’une exécution, ce qui limite les différences entre systèmes et versions de Chromium.

Pour une évolution graphique intentionnelle, archiver les deux versions et la carte de différence, puis examiner les écarts par rapport aux spécifications et aux droits. Une nouvelle référence demande une revue tracée de l’évolution et des fichiers concernés. En cas d’écart inattendu, conserver les preuves et corriger avant de relancer. Les maquettes définitives et les photos autorisées restent des prérequis distincts.
