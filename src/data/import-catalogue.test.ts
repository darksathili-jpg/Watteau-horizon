import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalogue } from './catalogue'
import { catalogueAcquisitionUrl, importCatalogue } from './import-catalogue'

const archivedBytes = readFileSync(new URL('../../data/parcoursup/cartographie-2026-valenciennois.json', import.meta.url))
const archivedManifest = JSON.parse(readFileSync(new URL('../../data/parcoursup/manifest.json', import.meta.url), 'utf8'))

// Ces lignes fictives servent aux tests du moteur et ne sont jamais proposées dans le catalogue.
const fixtureRow = {
  annee: '2026',
  etab_uai: '0599999Z',
  etab_nom: 'Établissement de test',
  commune: 'Ville fictive',
  gta: '987654',
  gti: '987654',
  nm: [' Formation fictive '],
  tf: ['Catégorie fictive', 'Autre catégorie fictive'],
  app: null,
  fiche: 'https://dossierappel.parcoursup.fr/Candidats/public/fiches/afficherFicheFormation?g_ta_cod=987654',
}

function makeSnapshot(rows: unknown[], overrides = {}, totalCount = rows.length) {
  const raw = Buffer.from(JSON.stringify({ total_count: totalCount, results: rows }))
  const manifest = {
    ...archivedManifest,
    scope: 'Données fictives, prévues pour les tests uniquement.',
    scopeCommunes: ['Ville fictive'],
    selectedFormationCodes: ['987654'],
    expectedRows: rows.length,
    ...overrides,
    sha256: createHash('sha256').update(raw).digest('hex'),
  }
  manifest.acquisitionUrl = catalogueAcquisitionUrl(manifest)
  return { raw, manifest }
}

describe('catalogue Parcoursup', () => {
  it('reconstruit exactement le catalogue officiel embarqué à partir des octets archivés', () => {
    const imported = importCatalogue(archivedBytes, archivedManifest)
    expect(imported.catalogue).toEqual(catalogue)
    expect(imported.quarantine).toEqual([])
    expect(imported.missingFormationCodes).toEqual([])
    expect(new Set(catalogue.entries.map(({ id }) => id)).size).toBe(16)
    expect(catalogue.coverage).toMatchObject({
      acceptedRows: 16,
      campaign: '2026',
      collectedOn: '2026-11-26',
      sourceUpdatedOn: '2026-10-22',
      populatedFields: { name: 16, type: 16, modality: 3, durationYears: 0, officialUrl: 16 },
    })
  })

  it('conserve la provenance et les inconnues sans transformer une absence en modalité', () => {
    const { raw, manifest } = makeSnapshot([fixtureRow])
    const { catalogue: fixture } = importCatalogue(raw, manifest)
    const entry = fixture.entries[0]
    expect(entry?.id).toBe('parcoursup:2026:0599999Z:987654:987654')
    expect(entry?.name).toMatchObject({
      value: 'Formation fictive',
      provenance: {
        sourceUrl: archivedManifest.sourceUrl,
        datasetId: archivedManifest.datasetId,
        sourceId: '2026:0599999Z:987654:987654',
        campaign: '2026',
        collectedOn: archivedManifest.collectedOn,
        license: archivedManifest.license,
      },
    })
    expect(entry?.type.value).toBe('Catégorie fictive / Autre catégorie fictive')
    expect(entry?.modality.value).toBeNull()
    expect(entry?.durationYears.value).toBeNull()
  })

  it('distingue deux formations d’un même portail et interprète le marqueur apprentissage', () => {
    const second = { ...fixtureRow, gta: '987655', fiche: fixtureRow.fiche.replace('g_ta_cod=987654', 'g_ta_cod=987655'), app: ['Formations en apprentissage'] }
    const { raw, manifest } = makeSnapshot([fixtureRow, second], { selectedFormationCodes: ['987654', '987655'] })
    const { catalogue: fixture, quarantine } = importCatalogue(raw, manifest)
    expect(quarantine).toEqual([])
    expect(fixture.entries.map(({ id }) => id)).toEqual([
      'parcoursup:2026:0599999Z:987654:987654',
      'parcoursup:2026:0599999Z:987655:987654',
    ])
    expect(fixture.entries[1]?.modality.value).toBe('Apprentissage')
  })

  it('rejette un fichier altéré, une collecte incohérente et une archive tronquée', () => {
    const { raw, manifest } = makeSnapshot([fixtureRow])
    expect(() => importCatalogue(Buffer.concat([raw, Buffer.from('\n')]), manifest)).toThrow(/Empreinte/)
    expect(() => importCatalogue(raw, { ...manifest, license: 'Autre licence' })).toThrow(/Manifeste/)
    expect(() => importCatalogue(raw, { ...manifest, sourceUpdatedOn: '2026-02-30' })).toThrow(/Manifeste/)
    expect(() => importCatalogue(raw, { ...manifest, scopeCommunes: ['Autre ville'] })).toThrow(/collecte incohérente/)
    const truncated = makeSnapshot([fixtureRow], {}, 2)
    expect(() => importCatalogue(truncated.raw, truncated.manifest)).toThrow(/incomplet/)
  })

  it.each([
    ['hors-périmètre', { annee: '2025' }],
    ['hors-périmètre', { commune: 'Autre ville' }],
    ['hors-périmètre', { gta: '987655', fiche: null }],
    ['schema', { nm: 'Cette valeur doit être une liste' }],
    ['schema', { app: ['Modalité inconnue'] }],
    ['schema', { fiche: 'https://dossierappel.parcoursup.fr.example.org/Candidats/public/fiches/afficherFicheFormation?g_ta_cod=987654' }],
    ['schema', { fiche: fixtureRow.fiche.replace('g_ta_cod=987654', 'g_ta_cod=987655') }],
    ['schema', { fiche: fixtureRow.fiche + '&next=https://example.org' }],
  ])('met une ligne en quarantaine (%s)', (reason, changes) => {
    const { raw, manifest } = makeSnapshot([{ ...fixtureRow, ...changes }])
    const result = importCatalogue(raw, manifest)
    expect(result.quarantine).toMatchObject([{ index: 0, reason }])
    expect(result.catalogue.entries).toEqual([])
    expect(result.missingFormationCodes).toEqual(['987654'])
  })

  it('signale un doublon et met en quarantaine toutes les variantes contradictoires', () => {
    const identical = makeSnapshot([fixtureRow, fixtureRow])
    const duplicate = importCatalogue(identical.raw, identical.manifest)
    expect(duplicate.quarantine).toMatchObject([{ index: 1, reason: 'doublon' }])
    expect(duplicate.catalogue.coverage.acceptedRows).toBe(1)

    const different = makeSnapshot([fixtureRow, { ...fixtureRow, etab_nom: 'Autre dénomination de test' }])
    const conflict = importCatalogue(different.raw, different.manifest)
    expect(conflict.quarantine).toMatchObject([
      { index: 0, reason: 'contradiction' },
      { index: 1, reason: 'contradiction' },
    ])
    expect(conflict.catalogue.entries).toEqual([])
  })
})
