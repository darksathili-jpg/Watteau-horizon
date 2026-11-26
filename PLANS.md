# Plan de production

Statuts : TODO, IN_PROGRESS, BLOCKED, VERIFIED. VERIFIED exige preuves et résultats réels.

| Lot | Livrable | Statut | Critère |
|---|---|---|---|
| G0-A | Identité, Antoine, références campus | IN_PROGRESS | Assets individuels, droits et comparaison photo |
| G0-B | Sources officielles | VERIFIED | [Registre des notices](docs/SOURCES.md) avec URL, licence, couverture, date et schéma publié |
| G0-C | Conception pédagogique | IN_PROGRESS | Mission numérique et réflexion testées. Autres familles à concevoir |
| G1 | Prototype technique | VERIFIED | Build, tests, parcours clavier et mesure dans le [journal de vérification](docs/PROOFS.md) |
| G2 | Vertical slice provisoire | VERIFIED | Campus fictif marqué, mission, carnet, reprise et mode sans jeu vérifiés par [tests et captures](docs/PROOFS.md) |
| G2-R | Synchronisation et contrôles GitHub | VERIFIED | Branche avancée sans forcer, [Actions exécutées sur GitHub](docs/G2-R-G3.md#synchronisation-et-github-actions) |
| GitHub Pages | Prévisualisation de développement | BLOCKED | Workflow manuel et paquet vérifiés. [Activation Pages refusée et déploiement 404](docs/G2-R-G3.md#prévisualisation-github-pages) |
| G2-ART | Campus fictif, caméra et interactions | VERIFIED | [Audit graphique](docs/ART-REVIEW.md), captures sur ordinateur et mobile émulé, tests de déplacement et de collisions |
| G3 | Catalogue et comparateur | VERIFIED | Extrait Parcoursup 2026 de 16 offres dans quatre communes. [Import reproductible et provenance](docs/SOURCES.md#catalogue-parcoursup) |
| G4 | Extension | TODO | Missions validées, tests de régression |
| G5 | Recette | TODO | Audit et autorisation de publication |

Les lots G0-A/B/C sont indépendants. Ne pas bloquer B/C si A échoue. Les maquettes globales existantes sont conceptuelles, non contractuelles. Les photos du campus et le logo nécessitent vérification des droits. Le prototype peut utiliser des formes neutres explicitement provisoires, sans les présenter comme le lycée réel. Aucune donnée élève réelle dans les tests.

À chaque lot : documenter fichiers, commandes, résultats, anomalies, prochain travail. Ne pas demander de feu vert ordinaire. Ne pas promettre une exécution hors session.

Le registre G0-B porte sur les notices et leurs licences. La validation des exports officiels et des jointures relève de G3. Les droits de réutilisation et la comparaison architecturale G0-A restent à établir. Les preuves G1/G2 portent sur le prototype local dans Chromium.

La recette du 26 novembre 2026 couvre l’extrait local Parcoursup et le jeu sur Chromium. L’intégration Idéo, les mesures sur les appareils cibles et la recette architecturale restent à établir. [Preuves G2-R/G3/G2-ART](docs/G2-R-G3.md)
