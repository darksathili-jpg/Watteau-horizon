import type { SyntheticManifest } from './import-training'

// Données construites uniquement pour les tests, avec des identifiants et un domaine réservés.
export const syntheticRaw = `{
  "institutions": [
    { "id": "fixture-etablissement-a", "name": " Établissement fictif A " },
    { "id": "fixture-etablissement-b", "name": "Version 1" },
    { "id": "fixture-etablissement-b", "name": "Version 2" }
  ],
  "trainings": [
    { "id": "fixture-formation-a", "institutionId": "fixture-etablissement-a", "name": " Activité fictive A ", "city": "Ville fictive", "durationYears": 2 },
    { "id": "fixture-formation-a", "institutionId": "fixture-etablissement-a", "name": "Activité fictive A", "city": "Ville fictive", "durationYears": 2 },
    { "id": "fixture-formation-b", "institutionId": null, "name": "Activité fictive B", "city": " ", "durationYears": null },
    { "id": "fixture-formation-orpheline", "institutionId": "absent", "name": "Activité fictive C", "city": null, "durationYears": 1 },
    { "id": "fixture-formation-invalide", "institutionId": null, "name": "Activité fictive D", "city": null, "durationYears": -1 },
    { "id": "fixture-formation-contradictoire", "institutionId": null, "name": "Version 1", "city": null, "durationYears": 1 },
    { "id": "fixture-formation-contradictoire", "institutionId": null, "name": "Version 2", "city": null, "durationYears": 2 },
    { "id": "fixture-formation-lien-contradictoire", "institutionId": "fixture-etablissement-b", "name": null, "city": null, "durationYears": null }
  ]
}`

export const syntheticManifest: SyntheticManifest = {
  classification: 'synthetic',
  sourceUrl: 'https://watteau-horizon.invalid/fixture-v1.json',
  datasetId: 'formations-synthetiques-v1',
  campaign: 'jeu d’essai v1',
  collectedOn: '2026-11-25',
  license: 'fixture interne',
  sha256: '2fc185075aae17864dce38e0093bbcac9c91ee3f0862050711f234a660d653a4',
}
