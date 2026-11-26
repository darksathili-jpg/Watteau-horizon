# Guardians et barrières de qualité

Les Guardians sont six compétences versionnées dans `.agents/skills/`. Chaque compétence ouvre les mêmes contrôles que la recette complète, avec les prérequis dont elle a besoin.

| Guardian | Commande | Barrières |
| --- | --- | --- |
| Production | `npm run guardian -- production` | Q1, Q8 et les prérequis de Q8 |
| Gameplay | `npm run guardian -- gameplay` | Q2, Q7 |
| Direction artistique | `npm run guardian -- art` | Q3 |
| Accessibilité | `npm run guardian -- accessibility` | Q4 |
| Données | `npm run guardian -- data` | Q5 |
| Sécurité et confidentialité | `npm run guardian -- privacy` | Q6 |

## Critères et preuves

| Barrière | Critère exécutable | Preuve |
| --- | --- | --- |
| Q1 · Référence et compilation | Révision de référence ancêtre de HEAD. Inventaire et empreintes des fichiers de tests complets. Commandes historiques intactes. Autotests du harness, build TypeScript/Vite et vérifications statiques réussis. | `baseline.json`, journaux de compilation et de contrôle |
| Q2 · Fonctionnalités et régressions | Au moins 28 tests Vitest et 9 scénarios Playwright réussis, sans omission ni échec attendu compté comme une réussite. | `unit.json`, `playwright.json`, captures et traces |
| Q3 · Visuels et comparaison | Empreintes du décor, de l’atlas et du portrait conformes à la référence. Dimensions identiques et aucun pixel différent dans les cinq comparaisons. | `visual/comparison.json`, paires d’images et différences |
| Q4 · Accessibilité automatisée | Scénarios axe existants réussis sur les vues, le dialogue et le comparateur avec une provenance ouverte. La recette préserve les commandes clavier, le mode sans jeu et la réduction des animations. | Résultats Playwright et journaux axe |
| Q5 · Données | Correspondance exacte entre l’archive officielle, le manifeste et le catalogue généré. Tests des inconnues, codes, doublons, contradictions et quarantaines. | Journal de `catalogue:check` et des tests de données |
| Q6 · Sécurité et confidentialité | Pas de secret reconnu dans les fichiers de travail examinés ou le JavaScript compilé. CSP et référent conformes. Rapport npm exploitable sans vulnérabilité modérée ou supérieure. Scénarios navigateur sans transmission externe ou écriture réseau, avec sauvegarde, export, effacement et stockage indisponible exercés. | Journaux de contrôle, audit JSON dans le journal npm et résultats Playwright |
| Q7 · Mesures et protocole moteur | Échantillons desktop et mobile émulé présents. Budget de 450 Kio gzip pour le JavaScript du jeu et de 16 Kio pour le comparateur. Protocole 3D structuré avec des essais à réaliser. | `budgets.json`, mesures navigateur, [protocole moteur](ENGINE.md) |
| Q8 · Mise à disposition élèves | Q1 à Q7 réussies. Checkout propre et pièces de revue valides pour le commit et les fichiers contrôlés. | Décision du rapport, référence de révision et attestation |

Les budgets gzip sont des seuils initiaux définis au-dessus de l’ordre de grandeur mesuré sur le prototype. Les chronométrages émulés servent à caractériser une exécution. La recette sur les appareils réels relève de l’attestation.

`PASS` signifie que le critère a été contrôlé. `FAIL` indique une anomalie constatée. `BLOCKED` signale un prérequis, une pièce ou une mesure manquante. `NOT_RUN` s’applique aux barrières hors du périmètre d’une commande Guardian. Les contrôles indépendants continuent après un incident. La compilation est un prérequis des scénarios sur `dist/`.

## Profils

- `npm run quality` évalue Q1 à Q8. Le code de sortie est 0 si Q1 à Q7 passent. Q8 et la décision de mise à disposition restent visibles et séparées dans le rapport.
- `npm run quality:students -- --attestation /chemin/review.json` renvoie 0 seulement si les huit barrières passent. Sans attestation, la commande produit les preuves techniques, marque Q8 bloquée et renvoie 1.
- `npm run quality:test` exerce la logique des barrières, notamment le refus des preuves manquantes, altérées ou liées à une autre version. Les pièces de ces tests sont synthétiques.
- Le workflow Pages existant est réservé à la prévisualisation de développement. Il dépend de la recette technique puis vérifie le bandeau de prévisualisation et la consigne `noindex` du paquet. Aucune commande du harness ne déploie une version élèves.

## Pièces de revue

Utiliser le [gabarit](../../production/student-attestation.example.json) et le résultat `state` d’un checkout propre. Placer le dossier de pièces hors du checkout ou dans un emplacement ignoré. L’attestation complète renseigne `commit` et `subjectSha256`. Chaque revue vérifiée comporte `status: "verified"`, `approver` (rôle ou référence du responsable), une `date` au format ISO, un `file` relatif au dossier de l’attestation et l’empreinte `sha256` du fichier. L’exécutable vérifie ces liaisons et les octets des pièces. La validation du contenu des pièces et l’autorité des signataires relèvent de la revue institutionnelle.

| Revue | Pièce attendue |
| --- | --- |
| `art-rights` | Inventaire des assets et droits pour la diffusion. Statut explicite du campus fictif ou comparaison aux références autorisées. |
| `manual-accessibility` | Compte rendu clavier, lecteur d’écran, zoom, focus, réduction du mouvement et parcours sans jeu. Appareil, navigateur et anomalies consignés. |
| `target-device-performance` | Mesures réelles des appareils et du réseau cibles, critères fixés avant les mesures, traces et écarts. |
| `catalogue-and-licences` | Périmètre, campagne applicable, provenance, disponibilité des fiches, licence et obligations de diffusion. |
| `privacy-review` | Revue du stockage local, de l’export, de l’effacement, du réseau et de l’hébergement. Uniquement des données de recette synthétiques côté élèves. |
| `institutional-authorization` | Autorisation de diffusion pour l’établissement, le public et la version concernés. |

L’audit npm couvre les avis disponibles lors de l’exécution. Les motifs de secrets et les tests réseau couvrent un périmètre défini. Axe complète une revue manuelle. Les pièces d’autorisation restent nécessaires à Q8.
