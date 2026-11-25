# Plan de production

Statuts : TODO, IN_PROGRESS, BLOCKED, VERIFIED. VERIFIED exige preuves et résultats réels.

| Lot | Livrable | Statut | Critère |
|---|---|---|---|
| G0-A | Identité, Antoine, références campus | IN_PROGRESS | Assets individuels, droits et comparaison photo |
| G0-B | Sources officielles | VERIFIED | [Registre des notices](docs/SOURCES.md) avec URL, licence, couverture, date et schéma publié |
| G0-C | Conception pédagogique | IN_PROGRESS | Mission numérique et réflexion testées. Autres familles à concevoir |
| G1 | Prototype technique | VERIFIED | Build, tests, parcours clavier et mesure dans le [journal de vérification](docs/PROOFS.md) |
| G2 | Vertical slice provisoire | VERIFIED | Campus fictif marqué, mission, carnet, reprise et mode sans jeu vérifiés par [tests et captures](docs/PROOFS.md) |
| G3 | Catalogue et comparateur | TODO | Import reproductible, provenance, contrôles |
| G4 | Extension | TODO | Missions validées, tests de régression |
| G5 | Recette | TODO | Audit et autorisation de publication |

Les lots G0-A/B/C sont indépendants. Ne pas bloquer B/C si A échoue. Les maquettes globales existantes sont conceptuelles, non contractuelles. Les photos du campus et le logo nécessitent vérification des droits. Le prototype peut utiliser des formes neutres explicitement provisoires, sans les présenter comme le lycée réel. Aucune donnée élève réelle dans les tests.

À chaque lot : documenter fichiers, commandes, résultats, anomalies, prochain travail. Ne pas demander de feu vert ordinaire. Ne pas promettre une exécution hors session.

Le registre G0-B porte sur les notices et leurs licences. La validation des exports officiels et des jointures relève de G3. Les droits de réutilisation et la comparaison architecturale G0-A restent à établir. Les preuves G1/G2 portent sur le prototype local dans Chromium.
