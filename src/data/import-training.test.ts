import { describe, expect, it } from 'vitest'
import { importSyntheticTrainings } from './import-training'
import { syntheticManifest, syntheticRaw } from './synthetic-fixture'

describe('import des formations synthétiques', () => {
  it('vérifie l’empreinte et reproduit les valeurs et la provenance', async () => {
    const result = await importSyntheticTrainings(syntheticRaw, syntheticManifest)
    expect(await importSyntheticTrainings(syntheticRaw, syntheticManifest)).toEqual(result)
    expect(result.classification).toBe('synthetic')
    expect(result.sha256).toBe(syntheticManifest.sha256)
    expect(result.trainings.map((training) => training.id)).toEqual(['fixture-formation-a', 'fixture-formation-b'])
    expect(result.trainings[0]?.name.value).toBe('Activité fictive A')
    expect(result.trainings[0]?.institution).toEqual({
      value: 'Établissement fictif A',
      provenance: {
        sourceUrl: syntheticManifest.sourceUrl,
        datasetId: syntheticManifest.datasetId,
        sourceId: 'institutions:fixture-etablissement-a',
        campaign: syntheticManifest.campaign,
        collectedOn: syntheticManifest.collectedOn,
        license: syntheticManifest.license,
        transformation: 'Jointure par identifiant. Suppression des espaces périphériques et conversion des textes vides en null',
      },
    })
    expect(result.trainings[1]?.durationYears.value).toBeNull()
    expect(result.trainings[1]?.institution.value).toBeNull()
    expect(result.trainings[1]?.city.value).toBeNull()
    expect(result.coverage).toEqual({
      inputRows: 8,
      acceptedRows: 2,
      populatedFields: { name: 2, institution: 1, city: 1, durationYears: 1 },
      collectedOn: '2026-11-25',
    })
  })

  it('conserve une ligne identique et met en quarantaine toute contradiction ou jointure impossible', async () => {
    const { quarantine } = await importSyntheticTrainings(syntheticRaw, syntheticManifest)
    const reasons = quarantine.map(({ table, index, reason }) => `${table}:${index}:${reason}`)
    expect(reasons.sort()).toEqual([
      'institutions:1:conflict',
      'institutions:2:conflict',
      'trainings:1:duplicate',
      'trainings:3:unresolved-institution',
      'trainings:4:schema',
      'trainings:5:conflict',
      'trainings:6:conflict',
      'trainings:7:unresolved-institution',
    ])
  })

  it('rejette une empreinte altérée et un manifeste hors du schéma synthétique', async () => {
    await expect(importSyntheticTrainings(syntheticRaw + '\n', syntheticManifest))
      .rejects.toThrow('Empreinte du fichier brut invalide')
    await expect(importSyntheticTrainings(syntheticRaw, { ...syntheticManifest, sourceUrl: 'https://example.org' }))
      .rejects.toThrow('Manifeste synthétique invalide')
    await expect(importSyntheticTrainings(syntheticRaw, { ...syntheticManifest, collectedOn: '2026-02-30' }))
      .rejects.toThrow('Manifeste synthétique invalide')
  })
})
