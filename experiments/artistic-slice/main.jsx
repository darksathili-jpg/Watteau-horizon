import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { completeStage, stages } from '../../src/domain/mission'
import { eraseSave, exportSave, freshSave, readSave, writeSave } from '../../src/persistence/save'
import { Icon } from '../../src/ui/icons'
import { MissionSummary, Modal } from '../../src/ui/Mission'
import { Notebook } from '../../src/ui/Notebook'
import { interactionDistance, markers, movementKeys, start } from './world.mjs'
import '../../src/ui/styles.css'
import './slice.css'

const Formations = lazy(() => import('../../src/ui/Formations'))
const base = import.meta.env.BASE_URL
const params = new URLSearchParams(location.search)
const instrument = params.has('instrument')
const motionMedia = matchMedia('(prefers-reduced-motion: reduce)')
const saveKey = 'watteau-horizon:p4:v1'
const storage = () => ({
  getItem: () => localStorage.getItem(saveKey),
  setItem: (_, value) => localStorage.setItem(saveKey, value),
  removeItem: () => localStorage.removeItem(saveKey),
})

const guidance = [
  'Rejoins-moi au kiosque. On va comprendre comment une idée devient un service utile.',
  'Direction l’atelier. On connaît le besoin, on peut dessiner une première solution.',
  'Rendez-vous au point de test. Regardons comment les élèves se servent du prototype.',
  'Tu as essayé trois façons de travailler dans le numérique. Qu’aimerais-tu explorer ensuite ?',
]

function Glyph({ name, size = 22 }) {
  const paths = {
    phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm4 16h2',
    book: 'M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h7m-7 4h7m-7 4h5',
    school: 'm2 9 10-5 10 5-10 5L2 9Zm4 2v5c4 3 8 3 12 0v-5m4-2v7',
    map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
    menu: 'M4 6h16M4 12h16M4 18h16',
    pin: 'M12 22s7-7.1 7-13a7 7 0 0 0-14 0c0 5.9 7 13 7 13Zm0-10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    forward: 'm5 14 7-7 7 7', back: 'm5 10 7 7 7-7',
    left: 'm14 5-7 7 7 7', right: 'm10 5 7 7-7 7',
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}

function Portrait() {
  return <img className="portrait" src={base + 'assets/antoine.webp'} alt="" width="58" height="58" />
}

function MiniMap({ mapRef }) {
  return <div className="minimap" aria-hidden="true">
    <svg viewBox="0 0 126 126">
      <defs><pattern id="plan-grid" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#c8d3cb" strokeOpacity=".17" strokeWidth=".7" /></pattern></defs>
      <circle cx="63" cy="63" r="61" fill="#25332e" />
      <circle cx="63" cy="63" r="60" fill="url(#plan-grid)" />
      <path d="M12 88V32h24V17h54v15h24v70h-16V44H28v52Z" fill="#64736c" stroke="#b4bcb1" strokeWidth="1.2" />
      <path d="M30 60h67M63 43v74M36 83l27 12 34-16" fill="none" stroke="#b5b5a0" strokeOpacity=".5" strokeWidth="5" />
      <path d="M39 78h-8v11h8zm54 0h-8v11h8z" fill="#526b46" />
      <path d="M0 63h126M63 0v126" fill="none" stroke="#dce4de" strokeOpacity=".21" strokeDasharray="2 5" />
      <path d="M63 14l3 4-3 4-3-4Z" fill="#f4d36c" />
      <g ref={mapRef}><circle r="9" fill="#6dcce9" fillOpacity=".32" /><path d="M0-6l4 10-4-2-4 2Z" fill="#daf7ff" stroke="#0d4b67" strokeWidth="1.1" /></g>
    </svg>
    <span>N</span>
  </div>
}

function Shortcut({ icon, shortcut, children, onClick }) {
  return <button className="shortcut" onClick={onClick}>
    <span className="shortcut-icon"><Glyph name={icon} /></span>
    <span className="shortcut-text"><kbd>{shortcut}</kbd>{children}</span>
  </button>
}

function Answer({ stage, onClose, onComplete }) {
  const [choice, setChoice] = useState(null)
  const [reviewed, setReviewed] = useState(false)
  const verdict = reviewed ? stage.options[choice] : null
  return <Modal title={stage.title} onClose={onClose}>
    <div className="dialog-companion"><Portrait /><div><strong>Antoine</strong><p>{stage.role}</p></div></div>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (verdict?.advance) onComplete(stage.id)
      else if (choice !== null) setReviewed(true)
    }}>
      <fieldset>
        <legend>{stage.prompt}</legend>
        <div className="answers">{stage.options.map(({ label }, index) => <label className="answer" key={label}>
          <input type="radio" name="answer" checked={choice === index} onChange={() => { setChoice(index); setReviewed(false) }} />
          <span>{label}</span>
        </label>)}</div>
      </fieldset>
      <div className={verdict ? 'answer-feedback' : 'sr-only'} role="status">{verdict?.feedback}</div>
      <div className="dialog-actions"><button className="button primary" disabled={choice === null}>
        {verdict?.advance ? 'Terminer l’étape' : 'Vérifier mon choix'}
      </button></div>
    </form>
  </Modal>
}

function App() {
  const [initial] = useState(() => readSave(storage))
  const [save, setSave] = useState(initial.save)
  const [storageError, setStorageError] = useState(initial.problem)
  const [mode, setMode] = useState(params.get('mode') === 'accessible' ? 'accessible' : initial.save.mode)
  const [reduced, setReduced] = useState(initial.save.reduceMotion ?? motionMedia.matches)
  const [tab, setTab] = useState('campus')
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')
  const [range, setRange] = useState(10)
  const [overhead, setOverhead] = useState(false)
  const [modal, setModal] = useState(null)
  const [status, setStatus] = useState('')
  const [notebookRevision, setNotebookRevision] = useState(0)
  const count = save.completed.length
  const stage = stages[count]
  const scene = useRef(null)
  const mapRef = useRef(null)
  const pin = useRef(null)
  const world = useRef(null)
  const actionRef = useRef(null)
  const focusReturn = useRef(null)
  const heading = useRef(null)
  const engine = useRef(null)
  const wantsEngine = mode === 'game' && !error
  const controls = useRef({ keys: new Set(), stage: count, reduced, paused: true, dialogue: false, map: false })
  const state = controls.current
  state.stage = count
  state.reduced = reduced
  state.paused = tab !== 'campus' || Boolean(modal)
  state.dialogue = Boolean(modal?.stage)
  state.map = overhead
  const near = phase === 'ready' && range <= interactionDistance

  useEffect(() => {
    if (save.reduceMotion !== null) return
    const change = (event) => setReduced(event.matches)
    motionMedia.addEventListener('change', change)
    return () => motionMedia.removeEventListener('change', change)
  }, [save.reduceMotion])

  useEffect(() => {
    if (!wantsEngine) return
    const request = new AbortController()
    let mounted = null
    const onError = (message) => {
      if (request.signal.aborted) return
      setError(message)
      setPhase('failed')
      setMode('accessible')
      if (scene.current?.contains(document.activeElement)) requestAnimationFrame(() => heading.current?.focus())
    }
    setPhase('loading')
    import('./engine.mjs').then(({ mountEngine }) => mountEngine(world.current, {
      controls: state,
      onError,
      positionMarker(x, y, visible) {
        const element = pin.current
        if (!element) return
        element.hidden = !visible
        if (visible) {
          element.style.left = `${50 + 50 * x}%`
          element.style.top = `${50 - 50 * y}%`
        }
      },
      updateHud(position, distance) {
        if (mapRef.current) mapRef.current.setAttribute('transform', `translate(${63 + position.x * 2.6}, ${68 + position.z * 2.3})`)
        setRange(distance)
      },
    }, request.signal)).then((instance) => {
      if (request.signal.aborted) return instance.dispose()
      engine.current = mounted = instance
      if (instrument) window.watteauP4 = { observe: instance.observe, sample: instance.sample, readyAt: performance.now() }
      setPhase('ready')
    }).catch((problem) => onError(problem.message))
    return () => {
      request.abort()
      mounted?.dispose()
      engine.current = null
      if (instrument) delete window.watteauP4
      state.keys.clear()
    }
  }, [wantsEngine, state])

  useEffect(() => {
    if (state.paused) state.keys.clear()
  }, [state, state.paused])

  function commit(next) {
    setSave(next)
    const success = writeSave(storage, next)
    setStorageError(success ? null : 'Le stockage local est indisponible. Le carnet reste exportable pendant cette session.')
    return success
  }

  function navigate(next) {
    setModal(null)
    setTab(next)
    requestAnimationFrame(() => heading.current?.focus())
  }

  function switchMode(next) {
    commit({ ...save, mode: next })
    setMode(next)
    setError('')
    setOverhead(false)
    navigate('campus')
  }

  function show(next, trigger = document.activeElement) {
    focusReturn.current = trigger
    setModal(next)
  }

  function close() {
    const trigger = focusReturn.current
    setModal(null)
    requestAnimationFrame(() => {
      if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.disabled && trigger.getClientRects().length) trigger.focus()
      else if (mode === 'accessible') heading.current?.focus()
      else scene.current?.focus()
    })
  }

  function interact(trigger = scene.current) {
    if (!stage || (mode === 'game' && !near)) return
    engine.current?.gesture()
    show({ stage }, trigger)
  }

  actionRef.current = { modal, tab, mode, near, stage, interact, navigate, show }
  useEffect(() => {
    const clear = () => state.keys.clear()
    const keyDown = (event) => {
      const current = actionRef.current
      if (current.modal || current.tab !== 'campus' || current.mode !== 'game' || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const inScene = event.target === scene.current || event.target === document.body
      if (!inScene) return
      if (Object.hasOwn(movementKeys, key)) {
        event.preventDefault()
        state.keys.add(movementKeys[key])
      } else if (!event.repeat) {
        if (key === 'Enter') { event.preventDefault(); current.interact() }
        if (key === 'm') setOverhead((value) => !value)
        if (key === 'p') current.show({ phone: true })
        if (key === 'c') current.navigate('notebook')
        if (key === 'f') current.navigate('formations')
        if (key === 'Escape') { event.preventDefault(); current.show({ menu: true }) }
      }
    }
    const keyUp = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (Object.hasOwn(movementKeys, key)) state.keys.delete(movementKeys[key])
    }
    document.addEventListener('keydown', keyDown)
    document.addEventListener('keyup', keyUp)
    document.addEventListener('visibilitychange', clear)
    window.addEventListener('blur', clear)
    return () => {
      document.removeEventListener('keydown', keyDown)
      document.removeEventListener('keyup', keyUp)
      document.removeEventListener('visibilitychange', clear)
      window.removeEventListener('blur', clear)
    }
  }, [state])

  function exportNotebook() {
    const url = URL.createObjectURL(new Blob([exportSave(save)], { type: 'application/json' }))
    const download = document.createElement('a')
    download.href = url
    download.download = 'watteau-carnet-p4.json'
    download.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function resetNotebook() {
    const erased = eraseSave(storage)
    setSave({ ...freshSave(), mode })
    setNotebookRevision((value) => value + 1)
    setReduced(motionMedia.matches)
    setStorageError(erased ? null : 'Le navigateur a refusé l’effacement du stockage local.')
    setStatus(erased ? 'Données locales effacées.' : 'Le carnet de la session a été réinitialisé.')
    close()
  }

  const gameView = tab === 'campus' && mode === 'game'
  return <>
    <a className="skip-link" href="#p4-title">Aller au contenu</a>
    <main className={gameView ? 'p4-main p4-playing' : 'p4-main'}>
      <header className="masthead">
        <div className="brand"><img src={base + 'horizon.svg'} width="40" height="38" alt="" />
          <div><strong>Watteau Horizon</strong><span>Orientation post-bac</span></div>
        </div>
        <p className="context">Campus fictif <span>·</span> Démonstrateur P4</p>
        <div className="header-actions">
          {gameView && <button className="hud-button map-button" disabled={phase !== 'ready'} aria-pressed={overhead} onClick={() => setOverhead(!overhead)}><Glyph name="map" size={17} /> Carte</button>}
          <button className="hud-button mode-button" onClick={() => switchMode(mode === 'game' ? 'accessible' : 'game')}>{mode === 'game' ? 'Sans jeu' : 'Explorer en 3D'}</button>
        </div>
      </header>

      {wantsEngine && <section hidden={!gameView} className="play-region" aria-labelledby={gameView ? 'p4-title' : undefined}>
        <h1 id={gameView ? 'p4-title' : undefined} className="sr-only" tabIndex={-1} ref={gameView ? heading : null}>Cour d’automne</h1>
        <p id="p4-controls" className="sr-only">Active la scène et utilise les flèches pour avancer. Maj pour courir, Entrée pour interagir à proximité, M pour la carte, P pour le smartphone, C pour le carnet et F pour les formations.</p>
        <div ref={scene} className="world" role="region" tabIndex={0} aria-label="Scène jouable. Flèches pour se déplacer" aria-describedby="p4-controls"
          onPointerDown={(event) => { if (event.target instanceof HTMLCanvasElement) scene.current.focus({ preventScroll: true }) }}>
          <div ref={world} className="world-canvas" />
          {phase !== 'ready' && <div className="loading-message" role="status">Chargement du campus 3D…</div>}
          {stage && <div className="world-marker" ref={pin} aria-hidden="true" hidden><span>{count === 0 ? 'Antoine' : stage.place}</span><i /></div>}
        </div>

        <aside className="hud companion-hud" aria-label="Message d’Antoine">
          <Portrait />
          <div><strong>Antoine</strong><p>{guidance[count]}</p></div>
        </aside>

        <section className="hud quest-hud" aria-labelledby="quest-title">
          <div className="quest-kicker"><Icon name="flag" size={15} /> {stage ? 'Mission active' : 'Mission terminée'}</div>
          <h2 id="quest-title">Le relais numérique</h2>
          <p>{stage ? stage.title : 'Poursuis dans ton carnet.'}</p>
          <div className="quest-progress"><progress value={count} max={3} aria-label="Progression de la mission" /><span>{count} / 3</span></div>
        </section>

        <div className="map-hud"><MiniMap mapRef={mapRef} /></div>
        <div className="hud location-hud">
          <Glyph name="pin" size={17} />
          <div><strong>{stage?.place ?? 'Cour du campus'}</strong>
            <span>{stage ? phase !== 'ready' ? 'Destination' : near ? 'À portée' : `${Math.ceil(range)} m` : 'Parcours terminé'}</span></div>
          {stage && <button className="hud-button engage" disabled={!near} onClick={(event) => interact(event.currentTarget)}>Interagir</button>}
        </div>

        <div className="movement" aria-label="Commandes de déplacement">
          {['forward', 'left', 'back', 'right'].map((value) => <button key={value}
            aria-label={{ forward: 'Avancer', left: 'Aller à gauche', back: 'Reculer', right: 'Aller à droite' }[value]}
            className={`move-button move-${value}`} disabled={phase !== 'ready'}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              state.keys.add(value)
            }}
            onLostPointerCapture={() => state.keys.delete(value)}
            onPointerUp={() => state.keys.delete(value)}
            onPointerCancel={() => state.keys.delete(value)}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); state.keys.add(value) }
            }}
            onKeyUp={(event) => {
              if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); state.keys.delete(value) }
            }}
            onBlur={() => state.keys.delete(value)}><Glyph name={value} /></button>)}
        </div>

        <nav className="quickbar" aria-label="Outils du campus">
          <Shortcut icon="phone" shortcut="P" onClick={(event) => show({ phone: true }, event.currentTarget)}>Smartphone</Shortcut>
          <Shortcut icon="book" shortcut="C" onClick={() => navigate('notebook')}>Carnet</Shortcut>
          <Shortcut icon="school" shortcut="F" onClick={() => navigate('formations')}>Formations</Shortcut>
          <Shortcut icon="menu" shortcut="Échap" onClick={(event) => show({ menu: true }, event.currentTarget)}>Menu</Shortcut>
        </nav>
        <p className="hint">Flèches <span>Déplacement</span><i /> Maj <span>Courir</span><i /> Entrée <span>Interagir</span></p>
      </section>}

      {!gameView && <div className="reading">
        <nav className="reading-nav" aria-label="Navigation du prototype">
          <button className="button" aria-current={tab === 'campus' ? 'page' : undefined} onClick={() => navigate('campus')}>{mode === 'game' ? 'Cour du campus' : 'Sans jeu'}</button>
          <button className="button" aria-current={tab === 'notebook' ? 'page' : undefined} onClick={() => navigate('notebook')}>Carnet</button>
          <button className="button" aria-current={tab === 'formations' ? 'page' : undefined} onClick={() => navigate('formations')}>Formations</button>
          <button className="button" onClick={(event) => show({ menu: true }, event.currentTarget)}>Menu</button>
        </nav>
        <h1 id="p4-title" ref={heading} tabIndex={-1}>{tab === 'campus' ? 'Explorer sans jeu' : tab === 'notebook' ? 'Mon carnet' : 'Comparer les formations'}</h1>
        {error && <p className="p4-notice" role="status">La 3D est indisponible. {error} La mission continue ici.</p>}
        {storageError && <p className="p4-notice" role="status">{storageError}</p>}
        <p className="sr-only" role="status">{status}</p>
        {tab === 'campus' && <div className="two-column">
          <MissionSummary completed={save.completed} accessible onOpen={(next, trigger) => show({ stage: next }, trigger)} onReflection={() => navigate('notebook')} />
          <aside className="panel companion reading-companion"><Portrait /><div><h2>Antoine</h2><p>{guidance[count]}</p></div></aside>
        </div>}
        {tab === 'notebook' && <Notebook key={notebookRevision} save={save}
          onSave={(reflection) => commit({ ...save, reflection })}
          onErase={(trigger) => show({ erase: true }, trigger)} onExport={exportNotebook} onCompare={() => navigate('formations')} />}
        {tab === 'formations' && <Suspense fallback={<p role="status">Chargement du comparateur…</p>}><Formations /></Suspense>}
      </div>}
    </main>

    {modal?.stage && <Answer stage={modal.stage} onClose={close} onComplete={(id) => {
      commit({ ...save, completed: completeStage(save.completed, id) })
      focusReturn.current = gameView ? scene.current : heading.current
      close()
    }} />}
    {modal?.phone && <Modal title="Smartphone" onClose={close}>
      <div className="dialog-companion"><Portrait /><div><strong>Antoine</strong><p>{guidance[count]}</p></div></div>
      <p>{stage ? `Destination actuelle · ${stage.place}` : 'Mission terminée.'}</p>
      <div className="dialog-actions"><button className="button" onClick={() => navigate('notebook')}>Ouvrir le carnet</button></div>
    </Modal>}
    {modal?.menu && <Modal title="Menu du démonstrateur" onClose={close}>
      <p>Campus fictif · version de développement. La progression et le carnet restent dans ce navigateur.</p>
      <label className="motion-setting"><input type="checkbox" checked={reduced} onChange={(event) => {
        setReduced(event.target.checked)
        commit({ ...save, reduceMotion: event.target.checked })
      }} /> Réduire le mouvement</label>
      <div className="dialog-actions"><button className="button" onClick={() => switchMode(mode === 'game' ? 'accessible' : 'game')}>{mode === 'game' ? 'Continuer sans jeu' : 'Explorer en 3D'}</button></div>
    </Modal>}
    {modal?.erase && <Modal title="Effacer les données locales ?" onClose={close}>
      <p>La progression et les notes de ce démonstrateur seront effacées sur cet appareil.</p>
      <div className="dialog-actions"><button className="button" onClick={close}>Annuler</button><button className="button danger-button" onClick={resetNotebook}>Effacer</button></div>
    </Modal>}
  </>
}

createRoot(document.getElementById('root')).render(<App />)
