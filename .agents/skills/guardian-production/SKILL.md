---
name: guardian-production
description: Contrôler la référence, la compilation et l’admission d’une version Watteau Horizon destinée aux élèves.
---

Contrôle les barrières Q1 et Q8. Compare la révision, les signatures des tests et les commandes au manifeste de référence. Garde la trace du build et des contrôles exécutés. Pour Q8, vérifie les résultats Q1 à Q7 et la présence de pièces de revue valides pour le checkout propre.

Exécute `npm run guardian -- production`. Cette commande évalue les prérequis des huit barrières. Pour obtenir une décision spécifique à une mise à disposition élèves, utilise `npm run quality:students` avec l’attestation appropriée. Les deux commandes produisent un rapport et n’effectuent aucun déploiement.

Consulte le [protocole et les pièces attendues](../../../docs/production/QUALITY.md).
