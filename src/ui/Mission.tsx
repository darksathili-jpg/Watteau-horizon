import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { isMissionComplete, stages } from '../domain/mission'
import type { Stage, StageId } from '../domain/mission'
import { antoinePortrait } from '../game/art'
import { Icon } from './icons'

interface SummaryProps {
  completed: readonly StageId[]
  accessible?: boolean
  onOpen: (stage: Stage, trigger: HTMLElement) => void
  onReflection: () => void
}

export function MissionSummary({ completed, accessible = false, onOpen, onReflection }: SummaryProps) {
  const count = completed.length
  const finished = isMissionComplete(completed)
  return (
    <section className="panel mission-panel" aria-labelledby="mission-title">
      <div className="mission-content">
        <div className="section-label"><Icon name="flag" size={16} /> {finished ? 'Mission terminée' : 'Mission actuelle'}</div>
        <h2 id="mission-title">Le relais numérique</h2>
        <p>Aide le campus à mieux informer les élèves sur les ateliers du midi.</p>
      </div>
      <div className="mission-content mission-progress">
        <div className="progress-label"><span>Progression</span><strong>{count} / {stages.length} étapes</strong></div>
        <progress value={count} max={stages.length} aria-label="Progression de la mission" />
        <ol className="checklist">
          {stages.map((stage, index) => {
            const done = index < count
            const current = index === count
            return <li key={stage.id} data-state={done ? 'done' : current ? 'current' : 'pending'} aria-current={current ? 'step' : undefined}>
              <span className="step-symbol">{done ? <Icon name="check" size={15} /> : index + 1}</span>
              <div className="step-name"><strong>{stage.title}</strong><small>{stage.role}</small></div>
              {accessible && current && <button className="button small-button" onClick={(event) => onOpen(stage, event.currentTarget)}>Ouvrir</button>}
              {done && <span className="sr-only">Terminée.</span>}
              {!done && !current && <Icon name="lock" size={15} />}
            </li>
          })}
        </ol>
        {finished && <button className="button primary full-button" onClick={onReflection}>Réfléchir dans mon carnet</button>}
      </div>
    </section>
  )
}

export function Antoine({ completed }: { completed: readonly StageId[] }) {
  const messages = [
    'On commence au kiosque. On va découvrir comment une idée devient un service utile.',
    'Direction l’atelier. Maintenant qu’on connaît le besoin, on peut dessiner une première solution.',
    'Rendez-vous au point de test. Un prototype, ça s’améliore en observant comment on s’en sert.',
    'Tu as essayé trois façons de travailler dans le numérique. Qu’est-ce que tu aimerais retrouver dans une autre activité ?',
  ]
  return (
    <aside className="panel companion">
      <img src={antoinePortrait} width="62" height="62" alt="" />
      <div><h2>Antoine</h2><p>{messages[completed.length]}</p></div>
    </aside>
  )
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    heading.current?.focus()
    return () => node?.close()
  }, [])

  return <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={(event) => {
    event.preventDefault()
    onClose()
  }}>
    <div className="dialog-heading">
      <h2 id="dialog-title" tabIndex={-1} ref={heading}>{title}</h2>
      <button className="icon-button" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
    </div>
    {children}
  </dialog>
}

export function StageDialog({ stage, onClose, onComplete }: { stage: Stage; onClose: () => void; onComplete: () => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [checkedChoice, setCheckedChoice] = useState<number | null>(null)
  const checked = checkedChoice === null ? undefined : stage.options[checkedChoice]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checked?.advance) onComplete()
    else if (choice !== null) setCheckedChoice(choice)
  }

  return (
    <Modal title={stage.title} onClose={onClose}>
      <p className="dialog-role">{stage.role}</p>
      <form onSubmit={submit}>
        <fieldset>
          <legend>{stage.prompt}</legend>
          <div className="answers">
            {stage.options.map(({ label }, index) => (
              <label className="answer" key={label}>
                <input type="radio" name="answer" checked={choice === index} onChange={() => {
                  setChoice(index)
                  setCheckedChoice(null)
                }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={checked ? 'answer-feedback' : 'sr-only'} role="status">{checked?.feedback}</div>
        <div className="dialog-actions">
          <button className="button primary" type="submit" disabled={choice === null}>
            {checked?.advance ? 'Terminer l’étape' : 'Vérifier mon choix'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
