export interface CatalogueProvenance {
  sourceUrl: string
  datasetId: string
  sourceId: string
  campaign: string
  collectedOn: string
  license: string
  transformation: string
}

export interface CatalogueField<T> {
  value: T | null
  provenance: CatalogueProvenance
}

export interface CatalogueEntry {
  id: string
  name: CatalogueField<string>
  institution: CatalogueField<string>
  city: CatalogueField<string>
  type: CatalogueField<string>
  modality: CatalogueField<string>
  durationYears: CatalogueField<number>
  officialUrl: CatalogueField<string>
}

export interface Catalogue {
  entries: CatalogueEntry[]
  coverage: {
    sourceUrl: string
    publisher: string
    license: string
    licenseUrl: string
    campaign: string
    collectedOn: string
    sourceUpdatedOn: string
    scope: string
    scopeCommunes: string[]
    campaignRows: number
    localAllFieldsRows: number
    inputRows: number
    acceptedRows: number
    populatedFields: Record<Exclude<keyof CatalogueEntry, 'id'>, number>
    sha256: string
  }
}
