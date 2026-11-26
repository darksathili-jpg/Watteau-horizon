import { useState } from 'react'
import { catalogue } from '../data/catalogue'
import { Icon } from './icons'

type Entry = NonNullable<typeof catalogue>['entries'][number]
const criteria = [
  { key: 'name', label: 'Intitulé' },
  { key: 'institution', label: 'Établissement' },
  { key: 'city', label: 'Commune' },
  { key: 'type', label: 'Filière' },
  { key: 'modality', label: 'Modalité' },
  { key: 'durationYears', label: 'Durée indicative' },
] as const
const slots = ['A', 'B'] as const
type Slot = (typeof slots)[number]
const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })

function displayDate(value: string) {
  return date.format(new Date(value))
}

function formationLabel(formation: Entry) {
  return [formation.name.value, formation.institution.value, formation.city.value, formation.modality.value].filter(Boolean).join(' · ')
}

function FormationDetails({ entry }: { entry: Entry }) {
  return <>
    <dl className="comparison-fields">
      {criteria.map(({ key, label }) => {
        const value = entry[key].value
        const display = value === null ? 'Non renseigné par la source' : key === 'durationYears' ? `${value} ans` : value
        return <div key={key}><dt>{label}</dt><dd>{display}</dd></div>
      })}
    </dl>
    {entry.officialUrl.value && <a className="button" href={entry.officialUrl.value} rel="noreferrer">Voir la fiche Parcoursup</a>}
    <details className="provenance">
      <summary>Provenance par champ</summary>
      <dl>
        {[...criteria, { key: 'officialUrl', label: 'Lien de la fiche' } as const].map(({ key, label }) => {
          const field = entry[key].provenance
          return <div key={key}>
            <dt>{label}</dt>
            <dd><a href={field.sourceUrl} rel="noreferrer">Source {field.datasetId}</a> · identifiant {field.sourceId} · {field.campaign}</dd>
            <dd>{field.transformation} · collecte du {displayDate(field.collectedOn)} · {field.license}</dd>
          </div>
        })}
      </dl>
    </details>
  </>
}

function Questions() {
  return <ul className="criteria-list">
    <li>Quels cours et projets vais-je pratiquer ?</li>
    <li>Quel trajet, quel budget et quel rythme me conviendraient ?</li>
    <li>Quelles poursuites d’études pourrai-je explorer ?</li>
  </ul>
}

export default function Formations() {
  const [selected, setSelected] = useState<Record<Slot, string>>({ A: '', B: '' })
  if (!catalogue || catalogue.entries.length < 2) return <section className="panel content-panel formations-panel" aria-labelledby="compare-title">
    <div className="section-label"><Icon name="info" size={17} /> Comparateur indisponible</div>
    <h2 id="compare-title">Deux formations à mettre côte à côte</h2>
    <p>Le catalogue est en cours de vérification. Ces questions peuvent t’aider à préparer une comparaison.</p>
    <Questions />
    <a className="button" href="https://www.parcoursup.gouv.fr/" rel="noreferrer">Consulter Parcoursup</a>
  </section>

  const { entries, coverage } = catalogue
  const chosen = slots.filter((slot) => selected[slot]).length

  return <div className="catalogue">
    <section className="panel content-panel catalogue-intro" aria-labelledby="compare-title">
      <div>
        <div className="section-label"><Icon name="compare" size={17} /> Parcoursup · campagne {coverage.campaign}</div>
        <h2 id="compare-title">Deux formations à mettre côte à côte</h2>
        <p>{coverage.acceptedRows} offres dans cet extrait du numérique. {coverage.scope}</p>
        <p>Pour des vœux à venir, consulte la fiche officielle et la carte de la campagne concernée.</p>
      </div>
      <details className="catalogue-source" open>
        <summary>Source et couverture</summary>
        <p>{coverage.publisher} · données traitées le {displayDate(coverage.sourceUpdatedOn)}, collectées le {displayDate(coverage.collectedOn)}.</p>
        <p><a href={coverage.sourceUrl} rel="noreferrer">Cartographie Parcoursup</a> · <a href={coverage.licenseUrl} rel="noreferrer">{coverage.license}</a></p>
      </details>
    </section>
    <div className="two-column comparison-grid" aria-label="Comparaison de formations">
      {slots.map((slot) => {
        const other = slot === 'A' ? selected.B : selected.A
        const entry = entries.find(({ id }) => id === selected[slot])
        return <section className="panel content-panel comparison-card" aria-labelledby={`title-${slot}`} key={slot}>
          <h2 id={`title-${slot}`}>Formation {slot}</h2>
          <label htmlFor={`formation-${slot}`}>Choisir la formation {slot}</label>
          <select id={`formation-${slot}`} value={selected[slot]} onChange={(event) => {
            const id = event.target.value
            if (id !== other) setSelected({ ...selected, [slot]: id })
          }}>
            <option value="">Sélectionner une formation</option>
            {entries.map((formation) => <option key={formation.id} value={formation.id} disabled={other === formation.id}>{formationLabel(formation)}</option>)}
          </select>
          {entry && <FormationDetails entry={entry} />}
        </section>
      })}
    </div>
    <p className="sr-only" role="status">{chosen} sur 2 formations sélectionnées.</p>
    <section className="panel content-panel catalogue-questions" aria-labelledby="questions-title">
      <h2 id="questions-title">Questions pour aller plus loin</h2>
      <Questions />
      <a className="button" href="https://www.parcoursup.gouv.fr/" rel="noreferrer">Consulter Parcoursup</a>
    </section>
  </div>
}
