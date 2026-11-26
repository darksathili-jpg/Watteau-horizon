# Protocole expérimental de sélection du moteur 3D

État actuel **protocole défini, essais 3D à réaliser**. Phaser Canvas sert de témoin. Les candidats proposés sont Godot 4 Web et Three.js. Les essais isolés utilisent un même itinéraire, des volumes et textures de démonstration à droits vérifiés et la même mission. Ces actifs d’essai ne sont pas des références du lycée. Phaser reste le moteur du jeu existant pendant l’expérimentation.

## Construire un essai comparable

1. Figer le commit du témoin, la version de chaque moteur, les dépendances et le mode de rendu. Écrire la révision de chaque mini-scène et l’empreinte des actifs utilisés. Décrire le matériau et l’éclairage, le nombre d’objets et la résolution.
2. Rejouer le départ à froid, le déplacement et les collisions, l’activation des trois repères, la réduction du mouvement, le retour au parcours accessible, la reprise et l’effacement. Le parcours React reste équivalent pour tous les candidats.
3. Mesurer sur trois classes cibles, avec un ordinateur de l’établissement, un Android d’entrée de gamme et un appareil iOS réels. Identifier appareil, OS, navigateur, résolution, réseau et paramètres d’accessibilité. Conserver les mêmes conditions d’hébergement statique pour le témoin et les candidats.
4. Effectuer au moins cinq chargements à froid par combinaison moteur, appareil et navigateur, en alternant les moteurs. Pour chaque exécution, collecter octets transférés, temps jusqu’à l’entrée utilisable, intervalles d’images pendant 60 secondes d’itinéraire, erreurs console et problèmes d’interaction. Conserver les traces brutes, captures et échecs de chargement. Utiliser la limite de mémoire disponible comme observation distincte si l’API de mesure varie.
5. Calculer la médiane du chargement à froid et le p95 des intervalles, puis documenter la variabilité et les limitations. Un plantage, un parcours fonctionnel incomplet ou un échec de repli accessible est un résultat d’essai et reste dans le dossier.

Les seuils initiaux proposés avant essais sont inscrits dans [la configuration](../../production/engine-protocol.json). Le transfert initial est plafonné à 3 Mio. Les médianes de disponibilité proposées sont de 2 500 ms sur ordinateur et 3 500 ms sur mobile. Les p95 d’intervalle proposés sont de 25 ms et de 40 ms. Toute modification des seuils se documente avant de relancer la campagne.

## Prendre une décision

Écarter tout candidat qui échoue à une contrainte obligatoire sur un appareil cible ou au parcours accessible. Chez les candidats restants, comparer la lisibilité de la scène et la profondeur perçue, les coûts de transfert et de rendu, puis le coût de maintenance, la licence de distribution et la chaîne d’assets. Publier la grille renseignée avec les limites et les preuves. Conserver le témoin si les données physiques ou la revue de la valeur graphique sont incomplètes. Le protocole ne contient actuellement aucun résultat 3D.
