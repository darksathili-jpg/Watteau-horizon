# P3 · Essais comparés des moteurs

La campagne P3 évalue trois adaptateurs locaux pour une scène de démonstration sur campus fictif. Le moteur de production reste Phaser Canvas. Les fichiers de jeu, les visuels, les données, les tests historiques et le Harness V2 sont protégés par la référence existante. [Issue P3](https://github.com/darksathili-jpg/Watteau-horizon/issues/1) · [Méthode](ENGINE-TRIALS-METHOD.md)

## Configuration des démonstrateurs

Les candidats Three.js et Godot utilisent des volumes originaux aux mêmes coordonnées, un avatar provisoire d’environ 1,7 m, un cycle de marche, des variations de matériau et de lumière, trois repères et un cadrage de suivi à la troisième personne. Phaser Canvas sert de témoin expérimental en vue de dessus avec les mêmes limites, collisions, questions et déplacements. Le témoin de production reste la référence historique du Harness.

Les trois adaptateurs utilisent les mêmes contrôles et le même modèle de progression dans le shell expérimental. Les questions sont importées du module de mission existant. Le mode sans jeu est disponible directement sans chargement du moteur. Le stockage de l’essai, isolé par moteur, possède ses propres commandes de sauvegarde et d’effacement. Le parcours React, le carnet et le catalogue officiels restent dans le jeu de production.

Le cadrage, les trois positions de repères et la scène sont fixés avant mesure. Three.js et Godot partagent les dimensions des dalles, bâtiments, fenêtres, portes et bacs. La pose et l’articulation du personnage, les algorithmes d’ombre, les matériaux internes et le rendu des couleurs diffèrent. Le témoin Canvas présente une projection et une représentation du relief différentes. Les différences de cadence doivent être lues avec celles du contenu et de l’architecture des adaptateurs.

Des actifs procéduraux neutres constituent le décor. La géométrie et les matériaux ne reprennent aucune photographie du lycée. Les notices Three.js et Phaser sont produites au build et les licences de l’export Godot sont jointes au dossier Web. [Code et commandes](../../experiments/engine-trials/README.md) · [Grille de décision](../../experiments/engine-trials/decision-matrix.json)

La qualification reste liée aux appareils physiques et au contrat graphique approuvé. Les six revues Q8 restent indispensables à la diffusion élèves. [Protocole physique](ENGINE.md) · [Barrières du Harness](QUALITY.md)

## Conditions de mesure

Les deux profils utilisent Chromium 156.0.8078.79 sous Linux, sans interface graphique, avec ANGLE et SwiftShader. Le conteneur est limité à deux vCPU et 8 Gio de mémoire. Le profil ordinateur utilise un viewport de 1 440 × 960. Le profil mobile émulé utilise un viewport de 390 × 844, un facteur d’échelle de 1 et des commandes tactiles exercées via CDP. Le trajet de cadence utilise les mêmes flèches dans les deux profils. Le serveur écoute sur la boucle locale, sous un sous-chemin fixe et avec le même réglage gzip pour chaque moteur.

Chaque départ ouvre un contexte de navigateur neuf. L’ordre des moteurs tourne entre les répétitions. Le chronomètre s’arrête au premier rendu annoncé par l’adaptateur, lorsque l’entrée devient disponible. Le relevé par requête compte les corps HTTP encodés et les en-têtes de réponse. Les mesures de cadence utilisent les sorties de rendu Phaser et Three.js, et le signal `RenderingServer.frame_post_draw` de Godot. Ces intervalles décrivent les callbacks de rendu observés, avec le coût du bridge Godot. Leur p95 est la valeur de rang `ceil(0,95 × n)` de la série triée. L’encodage des vidéos a lieu à part.

La carte et ses collisions sont identiques dans les trois adaptations. Les deux caméras 3D utilisent 48° de champ vertical. Three.js active l’anticrénelage WebGL et une carte d’ombre de 1 024 pixels. Godot utilise une carte d’ombre de 1 024 pixels et les réglages Compatibility du projet. La figure est articulée avec des blocs dans Three.js et des volumes arrondis dans Godot. À hauteur de l’atelier, les captures montrent un sol et des façades plus clairs dans Godot. Three.js montre plus d’écart entre les vitrages et les toits sombres. Les trois repères correspondent aux mêmes places et leurs anneaux changent avec la progression.

L’export Godot a démarré sans isolement interorigine. Son amorce Web contient un script embarqué et charge WebAssembly. Le serveur isolé sert ce format pour l’essai. Toute intégration au client de production demanderait une revue de la CSP, du chargement WASM, du poids et du lien vers le parcours React. Le prototype et ses règles de sécurité sont préservés.

## Résultats de présélection

Les 30 lancements ont donné un premier rendu. Les six parcours ont exercé huit contrôles chacun. Ils couvrent les collisions, les trois interactions dans l’ordre, la réduction du mouvement, la sauvegarde et la reprise, l’effacement isolé et les trois étapes en mode sans jeu. Les audits axe du parcours sans jeu ont tous passé. L’entrée sans jeu a aussi été testée sans téléchargement du moteur, et un chargement Three.js volontairement interrompu a laissé la première étape accessible dans la variante sans jeu.

| Moteur | Profil | Départs prêts | Médiane prêt | Transfert complet médian | Mouvement observé | P95 image | Parcours |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phaser Canvas | Ordinateur | 5/5 | 551,7 ms | 327 675 octets | 60 s | 60,1 ms | Réussi |
| Phaser Canvas | Mobile émulé | 5/5 | 443,7 ms | 327 675 octets | 60 s | 17,1 ms | Réussi |
| Three.js | Ordinateur | 5/5 | 515 ms | 143 515 octets | 59,8 s | 214,7 ms | Réussi |
| Three.js | Mobile émulé | 5/5 | 395,7 ms | 143 515 octets | 59,92 s | 64,7 ms | Réussi |
| Godot 4 Web | Ordinateur | 5/5 | 2 390,9 ms | 10 300 040 octets | 60,71 s | 228,3 ms | Réussi |
| Godot 4 Web | Mobile émulé | 5/5 | 1 982,7 ms | 10 300 040 octets | 60,24 s | 79 ms | Réussi |

Le transfert est le nombre d’octets encodés achevés et des en-têtes de réponse tel que rapporté par Chromium. Pour Godot sur mobile, la colonne transfert utilise la reprise des cinq relevés complets. La disponibilité de la série d’origine reste visible dans le tableau. La fenêtre demandée est de 60 secondes. L’intervalle du premier au dernier callback varie légèrement avec la cadence du moteur. Le dossier brut conserve heures relatives, intervalles, nombres d’images et segments du trajet terminés.

La campagne a produit douze captures et six vidéos WebM. Les prises au départ et près de l’atelier montrent les trois moteurs pour les deux profils. Les vidéos emploient les flèches sur les deux viewports afin de conserver la scène à l’écran. Le tactile est exercé séparément dans la recette fonctionnelle mobile. [Relevé structuré et anomalies](../../evidence/p3/receipt.json)

### Anomalies et contre-mesures

Le premier diagnostic Three.js avait lu l’état de marche juste après le relâchement de la touche. Le contrôle corrigé attend l’arrêt pendant la pression, à moins d’un pas maximal de la limite de collision. Le diagnostic ciblé corrigé et les six parcours de la campagne ont réussi.

Chromium a enregistré trois `net::ERR_ABORTED` sur `index.wasm` pendant les cinq départs Godot mobile d’origine, malgré une scène ouverte. Un quatrième signal identique est présent dans la série de mouvement Godot mobile. La campagne initiale a donc renvoyé le code 1 à cause de ces événements. Les trois relevés de transfert incomplets n’entrent pas dans la médiane des corps HTTP complets. La reprise attend le repos réseau après avoir marqué le premier rendu. Les cinq départs ciblés sont complets, avec zéro erreur réseau, une médiane de 2 190 ms et 10 300 040 octets par démarrage. Le serveur déclare 10 297 043 octets de corps terminés à chaque répétition, en cohérence avec la différence des en-têtes. La reprise ciblée du mouvement de Godot mobile a aussi réussi, sans erreur réseau et avec un p95 de 82,8 ms sur 60,22 s observées. Le tableau conserve la campagne initiale pour la comparaison entre moteurs. Les traces initiales et les deux reprises sont archivées avec les mêmes empreintes d’artefacts.

### Lecture de décision

| Critère | Phaser Canvas | Three.js | Godot 4 Web |
| --- | --- | --- | --- |
| Technique | Témoin 2D sous le plafond de transfert. Le p95 dépasse le seuil proposé sur ordinateur émulé et passe sur le profil mobile. | Transfert le plus faible des trois adaptateurs, avec p95 supérieur au seuil sur les deux profils. | Dépasse le plafond de 3 Mio avec le modèle officiel testé. Les p95 dépassent les deux seuils locaux. |
| Valeur artistique | Vue de dessus utile pour lire les trajectoires. | Point de vue à la troisième personne, ombres, modelé angulaire et palette sombre. | Cadrage correspondant, silhouette plus arrondie, valeurs plus claires et ombres distinctes. |
| Maintenance | Dépendance npm et chaîne actuelle maîtrisée. | Une dépendance npm isolée et un export Vite. Le rendu et les contrôles restent dans le même environnement JS. | Éditeur, modèle d’export Web de version exacte, GDScript et bridge de rendu entre l’iframe et la logique commune. |
| Accessibilité | Les parcours du témoin et le parcours React de production ont été exercés. | Même shell, mêmes interactions et parcours sans moteur vérifiés. | Mêmes contrôles, avec un chemin sans moteur vérifié. |

Le WASM Godot pèse 39 514 754 octets bruts et 10 185 394 octets gzip avec les paramètres du serveur de la campagne. Ce fichier seul dépasse le budget du protocole pour ce modèle d’export. Les seuils de chargement et de cadence restent à appliquer sur les appareils physiques cibles. La résolution plus faible du profil mobile émulé réduit la charge de rendu dans ce navigateur local. Les chiffres ne préjugent pas des performances d’un téléphone.

**Décision différée.** Phaser Canvas reste en production. Les essais physiques sur ordinateur d’établissement, Android d’entrée de gamme et iOS, le contrat graphique approuvé, les droits des visuels, et les revues manuelles d’intégration et d’accessibilité conditionnent le réexamen. Le fichier du protocole de qualification physique reste au stade planifié. [Grille versionnée](../../experiments/engine-trials/decision-matrix.json)

### Contrôles du socle

Le profil élèves du Harness V2 a été exécuté sur le checkout propre contenant les démonstrateurs. Q1 à Q7 ont passé avec 28 tests Vitest, 9 scénarios Chromium, 6 tests du harness et cinq comparaisons graphiques à zéro pixel différent. Q8 est restée bloquée et le profil élèves a renvoyé le code 1. Le build isolé des démonstrateurs a passé cinq tests supplémentaires du modèle commun, la reconstruction depuis son lockfile, l’export Godot et son audit npm. npm audit a remonté zéro vulnérabilité dans les deux projets au moment des essais. [Contrôle GitHub du socle](https://github.com/darksathili-jpg/Watteau-horizon/actions/runs/45814885732) · [Rapport de décision Q8](QUALITY.md#pièces-de-revue)
