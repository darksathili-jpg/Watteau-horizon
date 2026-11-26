import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { completeStage, stages } from '../domain/mission'
import type { Stage } from '../domain/mission'
import type { Position } from '../game/campus'
import { eraseSave, exportSave, freshSave, readSave, writeSave } from '../persistence/save'
import type { Mode, Save } from '../persistence/save'
import { CampusView } from './CampusView'
import { Antoine, MissionSummary, Modal, StageDialog } from './Mission'
import { Notebook } from './Notebook'
import { Icon } from './icons'

const Formations = lazy(() => import('./Formations'))

const tabs = [
  { id: 'explorer', label: 'Explorer', heading: 'Le campus', icon: 'compass' },
  { id: 'carnet', label: 'Carnet', heading: 'Mon carnet', icon: 'book' },
  { id: 'formations', label: 'Formations', heading: 'Les formations', icon: 'compare' },
] as const
type Page = (typeof tabs)[number]['id']
type OpenDialog = { type: 'stage'; stage: Stage; trigger: HTMLElement } | { type: 'erase'; trigger: HTMLElement }

const getStorage = () => window.localStorage
const mediaQuery = '(prefers-reduced-motion: reduce)'
const writeProblem = 'L’enregistrement local est indisponible. Tu peux exporter ton carnet pendant cette session.'

export function App() {
  const [initial] = useState(() => readSave(getStorage))
  const [save, setSave] = useState(initial.save)
  const [problem, setProblem] = useState(initial.problem)
  const [page, setPage] = useState<Page>('explorer')
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [resetCount, setResetCount] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia(mediaQuery).matches)
  const saveRef = useRef(save)
  const position = useRef(save.position)
  const pageHeading = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)
  const focusTarget = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const query = window.matchMedia(mediaQuery)
    function update(event: MediaQueryListEvent) { setSystemReduced(event.matches) }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (dialog || !focusTarget.current) return
    const target = focusTarget.current
    focusTarget.current = null
    const fallback = document.querySelector<HTMLElement>('.checklist button') ?? pageHeading.current
    const destination = target.isConnected ? target : fallback
    destination?.focus()
  }, [dialog])

  useEffect(() => {
    if (!focusHeading.current) return
    focusHeading.current = false
    pageHeading.current?.focus()
  }, [page])

  const reduceMotion = save.reduceMotion ?? systemReduced
  const next = stages[save.completed.length]

  const change = useCallback((update: (current: Save) => Save) => {
    const updated = update({ ...saveRef.current, position: position.current })
    saveRef.current = updated
    setSave(updated)
    const persisted = writeSave(getStorage, updated)
    setProblem(persisted ? null : writeProblem)
    return persisted
  }, [])

  const trackPosition = useCallback((nextPosition: Position) => { position.current = nextPosition }, [])
  const flushPosition = useCallback(() => {
    const previous = saveRef.current.position
    if (previous.x !== position.current.x || previous.y !== position.current.y) {
      change((current) => current)
    }
  }, [change])

  function navigate(target: Page) {
    if (target === page) return
    flushPosition()
    focusHeading.current = true
    setPage(target)
  }

  function setMode(mode: Mode) {
    if (mode !== save.mode) change((current) => ({ ...current, mode }))
  }

  function closeDialog() {
    focusTarget.current = dialog?.trigger ?? null
    setDialog(null)
  }

  function openStage(stage: Stage, trigger: HTMLElement) {
    if (next?.id === stage.id) setDialog({ type: 'stage', stage, trigger })
  }

  function finishStage(stage: Stage) {
    change((current) => ({ ...current, completed: completeStage(current.completed, stage.id) }))
    setAnnouncement(`${stage.title}, étape terminée.`)
    closeDialog()
  }

  function exportNotebook() {
    const data = exportSave({ ...saveRef.current, position: position.current })
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'watteau-horizon-carnet.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function eraseNotebook() {
    if (!eraseSave(getStorage)) {
      setProblem('L’effacement local a échoué. Les données peuvent encore se trouver sur cet appareil.')
      closeDialog()
      return
    }
    const blank = freshSave()
    position.current = blank.position
    saveRef.current = blank
    setSave(blank)
    setResetCount((count) => count + 1)
    setProblem(null)
    setAnnouncement('Les données locales ont été effacées.')
    closeDialog()
  }

  return (
    <div className="app" data-reduced-motion={reduceMotion}>
      <a className="skip-link" href="#main">Aller au contenu</a>
      {import.meta.env.VITE_WATTEAU_PREVIEW === '1' && <div className="preview-banner">Prévisualisation de développement · Campus fictif</div>}
      <header className="site-header">
        <div className="site-width header-inner">
          <button className="identity" onClick={() => navigate('explorer')}>
            <span className="identity-mark"><Icon name="brand" size={26} /></span>
            <span>Watteau <strong>Horizon</strong></span>
          </button>
          <nav aria-label="Navigation principale" className="navigation">
            {tabs.map(({ id, label, icon }) => <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon name={icon} size={18} /> {label}</button>)}
          </nav>
          <span className="privacy-badge"><span /> Progression locale</span>
        </div>
      </header>
      <main className="site-width main" id="main" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1 tabIndex={-1} ref={pageHeading}>{tabs.find(({ id }) => id === page)?.heading}</h1>
            {page === 'explorer' && <p>Une première exploration des métiers du numérique.</p>}
          </div>
          {page === 'explorer' && <div className="mode-picker" role="group" aria-label="Mode d’exploration">
            <button type="button" aria-pressed={save.mode === 'game'} onClick={() => setMode('game')}><Icon name="controller" size={20} /> Mode jeu</button>
            <button type="button" aria-pressed={save.mode === 'accessible'} onClick={() => setMode('accessible')}><Icon name="list" size={19} /> Sans jeu</button>
          </div>}
        </div>
        {problem && <p className="notice" role="alert">{problem}</p>}
        <div className="sr-only" role="status">{announcement}</div>
        {page === 'explorer' && <div className={save.mode === 'game' ? 'two-column explorer-grid' : 'two-column accessible-grid'}>
          {save.mode === 'game' && <CampusView
            key={resetCount}
            position={position.current}
            completed={save.completed}
            next={next}
            reduceMotion={reduceMotion}
            onPosition={trackPosition}
            onSettled={flushPosition}
            onOpen={openStage}
            onAccessible={() => setMode('accessible')}
          />}
          <div className="explorer-sidebar">
            <MissionSummary
              completed={save.completed}
              accessible={save.mode === 'accessible'}
              onOpen={openStage}
              onReflection={() => navigate('carnet')}
            />
            <Antoine completed={save.completed} />
          </div>
          {save.mode === 'accessible' && <section className="panel content-panel accessible-note" aria-labelledby="accessible-title">
            <div className="section-label"><Icon name="list" size={17} /> Parcours sans jeu</div>
            <h2 id="accessible-title">Explore la mission à ton rythme</h2>
            <p>Ouvre chaque étape dans l’ordre. Tu retrouves les mêmes situations et le même carnet qu’en mode jeu.</p>
          </section>}
        </div>}
        {page === 'carnet' && <Notebook
          key={resetCount}
          save={save}
          onSave={(reflection) => change((current) => ({ ...current, reflection }))}
          onExport={exportNotebook}
          onErase={(trigger) => setDialog({ type: 'erase', trigger })}
          onCompare={() => navigate('formations')}
        />}
        {page === 'formations' && <Suspense fallback={<p role="status">Chargement des formations…</p>}><Formations /></Suspense>}
        <footer className="page-footer">
          <span>Prototype d’orientation · Campus fictif</span>
          <button type="button" className="motion-control" aria-pressed={reduceMotion} onClick={() => change((current) => ({ ...current, reduceMotion: !reduceMotion }))}>
            <Icon name="motion" size={17} /> Réduire les animations <span className="switch" aria-hidden="true" />
          </button>
        </footer>
      </main>
      {dialog?.type === 'stage' && <StageDialog stage={dialog.stage} onClose={closeDialog} onComplete={() => finishStage(dialog.stage)} />}
      {dialog?.type === 'erase' && <Modal title="Effacer le carnet et la progression ?" onClose={closeDialog}>
        <p>Les étapes, la position et les notes enregistrées dans ce navigateur seront effacées. Les fichiers déjà exportés resteront disponibles.</p>
        <div className="dialog-actions">
          <button className="button" onClick={closeDialog}>Annuler</button>
          <button className="button danger-button" onClick={eraseNotebook}>Confirmer l’effacement</button>
        </div>
      </Modal>}
    </div>
  )
}
