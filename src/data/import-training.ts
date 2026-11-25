export interface SyntheticManifest {
  classification: 'synthetic'
  sourceUrl: string
  datasetId: string
  campaign: string
  collectedOn: string
  license: 'fixture interne'
  sha256: string
}

interface Provenance {
  sourceUrl: string
  datasetId: string
  sourceId: string
  campaign: string
  collectedOn: string
  license: string
  transformation: string
}

interface Field<T> {
  value: T | null
  provenance: Provenance
}

interface Training {
  id: string
  name: Field<string>
  institution: Field<string>
  city: Field<string>
  durationYears: Field<number>
}

interface QuarantinedRow {
  table: 'institutions' | 'trainings'
  index: number
  sourceId: string | null
  reason: 'schema' | 'duplicate' | 'conflict' | 'unresolved-institution'
}

interface InstitutionRow {
  id: string
  name: string | null
}

interface TrainingRow {
  id: string
  institutionId: string | null
  name: string | null
  city: string | null
  durationYears: number | null
}

interface IndexedRow<T> {
  row: T
  index: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normaliseText(value: unknown): string | null | undefined {
  if (typeof value === 'string') return value.trim() || null
  return value === null ? null : undefined
}

function readInstitution(value: unknown): InstitutionRow | undefined {
  if (!isRecord(value)) return undefined
  const id = normaliseText(value.id)
  const name = normaliseText(value.name)
  if (id && name !== undefined) return { id, name }
}

function readTraining(value: unknown): TrainingRow | undefined {
  if (!isRecord(value)) return undefined
  const id = normaliseText(value.id)
  const institutionId = normaliseText(value.institutionId)
  const name = normaliseText(value.name)
  const city = normaliseText(value.city)
  const durationYears = value.durationYears
  const validDuration = durationYears === null ||
    (typeof durationYears === 'number' && Number.isFinite(durationYears) && durationYears > 0)
  if (id && institutionId !== undefined && name !== undefined && city !== undefined && validDuration) {
    return { id, institutionId, name, city, durationYears }
  }
}

function indexRows<T extends { id: string }>(
  table: QuarantinedRow['table'],
  values: unknown[],
  read: (value: unknown) => T | undefined,
  quarantine: QuarantinedRow[],
) {
  const groups = new Map<string, [IndexedRow<T>, ...IndexedRow<T>[]]>()
  values.forEach((value, index) => {
    const row = read(value)
    if (!row) {
      const sourceId = isRecord(value) ? normaliseText(value.id) ?? null : null
      quarantine.push({ table, index, sourceId, reason: 'schema' })
      return
    }
    const group = groups.get(row.id)
    if (group) group.push({ row, index })
    else groups.set(row.id, [{ row, index }])
  })

  const rows = new Map<string, IndexedRow<T>>()
  for (const [sourceId, group] of groups) {
    const [first, ...rest] = group
    const signature = JSON.stringify(first.row)
    const conflict = rest.some(({ row }) => JSON.stringify(row) !== signature)
    if (!conflict) rows.set(sourceId, first)
    for (const { index } of conflict ? group : rest) {
      quarantine.push({ table, index, sourceId, reason: conflict ? 'conflict' : 'duplicate' })
    }
  }
  return rows
}

function validateManifest(manifest: SyntheticManifest) {
  const source = URL.parse(manifest.sourceUrl)
  const date = new Date(manifest.collectedOn)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(manifest.collectedOn) &&
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === manifest.collectedOn
  if (manifest.classification !== 'synthetic' || manifest.license !== 'fixture interne' ||
      source?.protocol !== 'https:' || !source.hostname.endsWith('.invalid') ||
      !manifest.datasetId.trim() || !manifest.campaign.trim() ||
      !validDate || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
    throw new Error('Manifeste synthétique invalide')
  }
}

function field<T>(
  manifest: SyntheticManifest,
  sourceId: string,
  value: T | null,
  transformation: string,
): Field<T> {
  const { sourceUrl, datasetId, campaign, collectedOn, license } = manifest
  return { value, provenance: { sourceUrl, datasetId, sourceId, campaign, collectedOn, license, transformation } }
}

const textTransformation = 'Suppression des espaces périphériques et conversion des textes vides en null'

export async function importSyntheticTrainings(raw: string, manifest: SyntheticManifest) {
  validateManifest(manifest)
  const bytes = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  if (sha256 !== manifest.sha256) throw new Error('Empreinte du fichier brut invalide')

  const input: unknown = JSON.parse(raw)
  if (!isRecord(input) || !Array.isArray(input.institutions) || !Array.isArray(input.trainings)) {
    throw new Error('Fichier brut invalide')
  }

  const quarantine: QuarantinedRow[] = []
  const institutions = indexRows('institutions', input.institutions, readInstitution, quarantine)
  const candidates = indexRows('trainings', input.trainings, readTraining, quarantine)
  const trainings: Training[] = []

  for (const { row, index } of candidates.values()) {
    const institution = row.institutionId === null ? undefined : institutions.get(row.institutionId)
    if (row.institutionId !== null && !institution) {
      quarantine.push({ table: 'trainings', index, sourceId: row.id, reason: 'unresolved-institution' })
      continue
    }
    const sourceId = `trainings:${row.id}`
    trainings.push({
      id: row.id,
      name: field(manifest, sourceId, row.name, textTransformation),
      institution: institution
        ? field(manifest, `institutions:${institution.row.id}`, institution.row.name, `Jointure par identifiant. ${textTransformation}`)
        : field<string>(manifest, sourceId, null, 'Identifiant d’établissement absent'),
      city: field(manifest, sourceId, row.city, textTransformation),
      durationYears: field(manifest, sourceId, row.durationYears, 'Identité, durée exprimée en années'),
    })
  }

  const coverage = {
    inputRows: input.trainings.length,
    acceptedRows: trainings.length,
    populatedFields: {
      name: trainings.filter((training) => training.name.value !== null).length,
      institution: trainings.filter((training) => training.institution.value !== null).length,
      city: trainings.filter((training) => training.city.value !== null).length,
      durationYears: trainings.filter((training) => training.durationYears.value !== null).length,
    },
    collectedOn: manifest.collectedOn,
  }
  return { classification: manifest.classification, sha256, trainings, quarantine, coverage }
}
