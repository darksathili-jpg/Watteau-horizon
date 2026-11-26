import { useState } from 'react'
import type { FormEvent } from 'react'
import { hasReflection, reflectionFields, reflectionLimit, stages } from '../domain/mission'
import type { Reflection } from '../domain/mission'
import type { Save } from '../persistence/save'
import { Icon } from './icons'

interface Props {
  save: Save
  onSave: (reflection: Reflection) => boolean
  onExport: () => void
  onErase: (trigger: HTMLElement) => void
  onCompare: () => void
}

export function Notebook({ save, onSave, onExport, onErase, onCompare }: Props) {
  const [draft, setDraft] = useState(save.reflection)
  const [message, setMessage] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const persisted = onSave(draft)
    const confirmation = persisted ? 'Réflexion enregistrée dans le carnet.' : 'Réflexion conservée pour cette session.'
    setMessage(hasReflection(draft) ? confirmation : 'La réflexion est vide.')
  }

  return <div className="two-column notebook-grid">
    <section className="panel content-panel" aria-labelledby="reflection-title">
      <h2 id="reflection-title">Ma réflexion</h2>
      <p>Note ce que tu aimerais explorer. Le carnet est local à cet appareil.</p>
      <form className="reflection-form" onSubmit={submit}>
        {reflectionFields.map(({ key, label, hint }) => <div className="form-field" key={key}>
          <label htmlFor={key}>{label}</label>
          <p id={`${key}-hint`}>{hint}</p>
          <textarea id={key} value={draft[key]} aria-describedby={`${key}-hint`} maxLength={reflectionLimit} rows={2} onChange={(event) => {
            setDraft({ ...draft, [key]: event.target.value })
            setMessage('')
          }} />
        </div>)}
        <div className="notebook-buttons">
          <button className="button primary" type="submit">Enregistrer ma réflexion</button>
          <button className="button" type="button" onClick={onCompare}>Voir les formations</button>
        </div>
        <div role="status" className={message ? 'save-message' : 'sr-only'}>{message}</div>
      </form>
    </section>
    <section className="panel content-panel notebook-meta" aria-labelledby="local-title">
      <div className="section-label"><Icon name="lock" size={16} /> Sur cet appareil</div>
      <h2 id="local-title">Ma progression</h2>
      <p>{save.completed.length} / {stages.length} étapes terminées.</p>
      <p>Le fichier exporté contient ta progression et ta réflexion. Conserve-le où tu le souhaites.</p>
      <div className="notebook-buttons">
        <button className="button" onClick={onExport}><Icon name="download" size={18} /> Exporter le carnet</button>
        <button className="button danger-button" onClick={(event) => onErase(event.currentTarget)}>Effacer les données locales</button>
      </div>
    </section>
  </div>
}
