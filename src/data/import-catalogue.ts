import { createHash } from 'node:crypto'
import type { Catalogue, CatalogueEntry, CatalogueField, CatalogueProvenance } from './catalogue-types'

const datasetId = 'fr-esr-cartographie_formations_parcoursup'
const sourceOrigin = 'https://data.enseignementsup-recherche.gouv.fr'
const recordsUrl = `${sourceOrigin}/api/explore/v2.1/catalog/datasets/${datasetId}/records`
const sourceUrl = `${sourceOrigin}/explore/dataset/${datasetId}/`
const publisher = "Ministère de l'Enseignement supérieur, de la Recherche et de l'Espace"
const license = 'Licence Ouverte v2.0 (Etalab)'
const licenseUrl = 'https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf'
const apprenticeshipLabel = 'Formations en apprentissage'
const ficheParameters = new Set(['g_ta_cod', 'typeBac', 'originePc'])
const fields = ['annee', 'etab_uai', 'etab_nom', 'commune', 'gta', 'gti', 'nm', 'tf', 'app', 'fiche']

interface Selection {
  campaign: string
  scopeCommunes: string[]
  selectedFormationCodes: string[]
}

interface SnapshotManifest extends Selection {
  schemaVersion: 1
  datasetId: string
  sourceUrl: string
  acquisitionUrl: string
  publisher: string
  license: string
  licenseUrl: string
  sourceUpdatedOn: string
  collectedOn: string
  scope: string
  expectedRows: number
  localAllFieldsRows: number
  campaignRows: number
  sha256: string
}

interface SourceRow {
  annee: string
  etab_uai: string
  etab_nom: string | null
  commune: string
  gta: string
  gti: string
  nm: string | null
  tf: string | null
  app: string | null
  fiche: string | null
}

interface QuarantinedRow {
  index: number
  sourceId: string | null
  reason: 'schema' | 'hors-périmètre' | 'doublon' | 'contradiction'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isCode(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]+$/.test(value)
}

function isUniqueStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim() === item && item.length > 0) &&
    new Set(value).size === value.length
}

export function catalogueAcquisitionUrl(selection: Selection) {
  const wrap = (item: string) => `'${item.replaceAll("'", "''")}'`
  const query = new URLSearchParams({
    select: fields.join(','),
    where: `annee = ${wrap(selection.campaign)} AND commune IN (${selection.scopeCommunes.map(wrap).join(',')}) AND gta IN (${selection.selectedFormationCodes.map(wrap).join(',')})`,
    order_by: 'commune ASC, etab_uai ASC, gta ASC, gti ASC',
    limit: '100',
  })
  return `${recordsUrl}?${query}`
}

function validateManifest(input: unknown): asserts input is SnapshotManifest {
  if (!isRecord(input) || input.schemaVersion !== 1 || input.datasetId !== datasetId ||
      input.sourceUrl !== sourceUrl || input.publisher !== publisher ||
      input.license !== license || input.licenseUrl !== licenseUrl ||
      typeof input.campaign !== 'string' || !/^\d{4}$/.test(input.campaign) ||
      !isDate(input.sourceUpdatedOn) || !isDate(input.collectedOn) ||
      input.sourceUpdatedOn > input.collectedOn ||
      typeof input.scope !== 'string' || !input.scope.trim() ||
      !isUniqueStringList(input.scopeCommunes) ||
      !isUniqueStringList(input.selectedFormationCodes) || !input.selectedFormationCodes.every(isCode) ||
      !isPositiveInteger(input.expectedRows) || input.expectedRows > 100 ||
      !isPositiveInteger(input.localAllFieldsRows) || !isPositiveInteger(input.campaignRows) ||
      input.expectedRows < input.selectedFormationCodes.length ||
      input.expectedRows > input.localAllFieldsRows || input.localAllFieldsRows > input.campaignRows ||
      typeof input.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.sha256)) {
    throw new Error('Manifeste Parcoursup invalide')
  }
  if (input.acquisitionUrl !== catalogueAcquisitionUrl({
    campaign: input.campaign,
    scopeCommunes: input.scopeCommunes,
    selectedFormationCodes: input.selectedFormationCodes,
  })) {
    throw new Error('URL de collecte incohérente avec le périmètre du manifeste')
  }
}

function readText(value: unknown): string | null | undefined {
  return typeof value === 'string' ? value.trim() || null : value === null ? null : undefined
}

function readList(value: unknown): string | null | undefined {
  if (value === null) return null
  if (!Array.isArray(value) || !value.every((part) => typeof part === 'string' && part.trim())) return undefined
  return value.map((part: string) => part.trim()).join(' / ') || null
}

function validateOfficialLink(link: string, gta: string) {
  const url = URL.parse(link)
  if (url?.origin !== 'https://dossierappel.parcoursup.fr' ||
      url.pathname !== '/Candidats/public/fiches/afficherFicheFormation' ||
      url.href !== link || url.username || url.password || url.hash) return false
  const codes = url.searchParams.getAll('g_ta_cod')
  return codes.length === 1 && codes[0] === gta &&
    Array.from(url.searchParams).every(([key, value]) =>
      ficheParameters.has(key) && url.searchParams.getAll(key).length === 1 && isCode(value))
}

function readRow(value: unknown): SourceRow | undefined {
  if (!isRecord(value) || typeof value.annee !== 'string' ||
      typeof value.etab_uai !== 'string' || !/^\d{7}[A-Z]$/.test(value.etab_uai) ||
      !isCode(value.gta) || !isCode(value.gti)) return
  const commune = readText(value.commune)
  const etab_nom = readText(value.etab_nom)
  const nm = readList(value.nm)
  const tf = readList(value.tf)
  const fiche = readText(value.fiche)
  const app = readList(value.app)
  if (!commune || etab_nom === undefined || nm === undefined || tf === undefined ||
      fiche === undefined || (fiche && !validateOfficialLink(fiche, value.gta)) ||
      (app !== null && app !== apprenticeshipLabel)) return
  return { annee: value.annee, etab_uai: value.etab_uai, etab_nom, commune, gta: value.gta, gti: value.gti, nm, tf, app, fiche }
}

function toSourceId(row: SourceRow) {
  return `${row.annee}:${row.etab_uai}:${row.gta}:${row.gti}`
}

function normaliseEntry(row: SourceRow, manifest: SnapshotManifest): CatalogueEntry {
  const sourceId = toSourceId(row)
  const source = {
    sourceUrl: manifest.sourceUrl,
    datasetId: manifest.datasetId,
    sourceId,
    campaign: manifest.campaign,
    collectedOn: manifest.collectedOn,
    license: manifest.license,
  } satisfies Omit<CatalogueProvenance, 'transformation'>
  function field<T>(value: T | null, transformation: string): CatalogueField<T> {
    return { value, provenance: { ...source, transformation } }
  }
  return {
    id: `parcoursup:${sourceId}`,
    name: field(row.nm, 'nm : libellés concaténés et espaces périphériques supprimés'),
    institution: field(row.etab_nom, 'etab_nom : espaces périphériques supprimés'),
    city: field(row.commune, 'commune : espaces périphériques supprimés'),
    type: field(row.tf, 'tf : libellés concaténés et espaces périphériques supprimés'),
    modality: field<string>(
      row.app === apprenticeshipLabel ? 'Apprentissage' : null,
      'app : mention explicite d’apprentissage ; valeur inconnue en l’absence de mention',
    ),
    durationYears: field<number>(null, 'Durée absente du schéma de la cartographie'),
    officialUrl: field(row.fiche, 'fiche : lien HTTPS du domaine Parcoursup vérifié contre le code gta'),
  }
}

export function importCatalogue(raw: Uint8Array, manifest: unknown) {
  validateManifest(manifest)
  const sha256 = createHash('sha256').update(raw).digest('hex')
  if (sha256 !== manifest.sha256) throw new Error('Empreinte de l’extrait Parcoursup invalide')

  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  if (!isRecord(input) || !Array.isArray(input.results) ||
      input.total_count !== manifest.expectedRows || input.results.length !== manifest.expectedRows) {
    throw new Error('Extrait Parcoursup incomplet ou enveloppe invalide')
  }

  const quarantine: QuarantinedRow[] = []
  const groups = new Map<string, [{ row: SourceRow; index: number }, ...{ row: SourceRow; index: number }[]]>()
  input.results.forEach((value, index) => {
    const row = readRow(value)
    if (!row) {
      quarantine.push({ index, sourceId: null, reason: 'schema' })
      return
    }
    const sourceId = toSourceId(row)
    if (row.annee !== manifest.campaign || !manifest.scopeCommunes.includes(row.commune) ||
        !manifest.selectedFormationCodes.includes(row.gta)) {
      quarantine.push({ index, sourceId, reason: 'hors-périmètre' })
      return
    }
    const group = groups.get(sourceId)
    if (group) group.push({ row, index })
    else groups.set(sourceId, [{ row, index }])
  })

  const entries: CatalogueEntry[] = []
  const acceptedFormationCodes = new Set<string>()
  for (const [sourceId, [first, ...rest]] of groups) {
    const firstRow = JSON.stringify(first.row)
    const conflict = rest.some(({ row }) => JSON.stringify(row) !== firstRow)
    if (!conflict) {
      entries.push(normaliseEntry(first.row, manifest))
      acceptedFormationCodes.add(first.row.gta)
    }
    for (const { index } of conflict ? [first, ...rest] : rest) {
      quarantine.push({ index, sourceId, reason: conflict ? 'contradiction' : 'doublon' })
    }
  }
  const missingFormationCodes = manifest.selectedFormationCodes.filter((code) => !acceptedFormationCodes.has(code))

  const populatedFields = {
    name: entries.filter((entry) => entry.name.value !== null).length,
    institution: entries.filter((entry) => entry.institution.value !== null).length,
    city: entries.filter((entry) => entry.city.value !== null).length,
    type: entries.filter((entry) => entry.type.value !== null).length,
    modality: entries.filter((entry) => entry.modality.value !== null).length,
    durationYears: entries.filter((entry) => entry.durationYears.value !== null).length,
    officialUrl: entries.filter((entry) => entry.officialUrl.value !== null).length,
  }
  const catalogue: Catalogue = {
    entries,
    coverage: {
      sourceUrl: manifest.sourceUrl,
      publisher: manifest.publisher,
      license: manifest.license,
      licenseUrl: manifest.licenseUrl,
      campaign: manifest.campaign,
      collectedOn: manifest.collectedOn,
      sourceUpdatedOn: manifest.sourceUpdatedOn,
      scope: manifest.scope,
      scopeCommunes: manifest.scopeCommunes,
      campaignRows: manifest.campaignRows,
      localAllFieldsRows: manifest.localAllFieldsRows,
      inputRows: input.results.length,
      acceptedRows: entries.length,
      populatedFields,
      sha256,
    },
  }
  return { catalogue, quarantine: quarantine.sort((a, b) => a.index - b.index), missingFormationCodes }
}
