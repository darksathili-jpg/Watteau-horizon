import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Stage, StageId } from '../domain/mission'
import { stations } from '../game/campus'
import type { Direction, Position } from '../game/campus'
import { campusArt } from '../game/art'
import { Icon } from './icons'

const arrowKeys = new Map<string, Direction>([
  ['ArrowUp', 'up'], ['ArrowLeft', 'left'], ['ArrowDown', 'down'], ['ArrowRight', 'right'],
])
const controls = [
  { direction: 'up', symbol: '↑', label: 'Avancer vers le haut' },
  { direction: 'left', symbol: '←', label: 'Avancer vers la gauche' },
  { direction: 'down', symbol: '↓', label: 'Avancer vers le bas' },
  { direction: 'right', symbol: '→', label: 'Avancer vers la droite' },
] as const

interface Props {
  position: Position
  completed: readonly StageId[]
  next: Stage | undefined
  reduceMotion: boolean
  onPosition: (position: Position) => void
  onSettled: () => void
  onOpen: (stage: Stage, trigger: HTMLElement) => void
  onAccessible: () => void
}

export function CampusView(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLDivElement>(null)
  const active = useRef(new Set<Direction>())
  const initialPosition = useRef(props.position)
  const current = useRef(props)
  current.current = props
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [nearby, setNearby] = useState<StageId | null>(null)

  useEffect(() => {
    const parent = host.current
    const region = input.current
    if (!parent || !region) return
    let cancelled = false
    let destroy: (() => void) | undefined
    const directions = active.current
    let frames = 0
    let elapsed = 0

    void import('../game/createCampus').then(({ createCampus }) => {
      if (cancelled) return
      destroy = createCampus({
        host: parent,
        initialPosition: initialPosition.current,
        directions,
        getProgress: () => current.current.completed,
        getReducedMotion: () => current.current.reduceMotion,
        onPosition: (position) => {
          region.dataset.position = `${position.x.toFixed(1)},${position.y.toFixed(1)}`
          current.current.onPosition(position)
        },
        onSettled: () => current.current.onSettled(),
        onNearby: setNearby,
        onReady: () => setStatus('ready'),
        onError: () => setStatus('error'),
        onFrame: (delta, spriteFrame) => {
          if (region.dataset.spriteFrame !== spriteFrame) region.dataset.spriteFrame = spriteFrame
          frames += 1
          elapsed += delta
          if (frames % 60 === 0 && elapsed > 0) {
            region.dataset.fps = String(Math.round(frames * 1000 / elapsed))
          }
        },
      })
    }).catch(() => {
      if (!cancelled) setStatus('error')
    })

    const pause = () => {
      directions.clear()
      current.current.onSettled()
    }
    window.addEventListener('blur', pause)
    window.addEventListener('pagehide', pause)
    document.addEventListener('visibilitychange', pause)
    return () => {
      cancelled = true
      directions.clear()
      destroy?.()
      window.removeEventListener('blur', pause)
      window.removeEventListener('pagehide', pause)
      document.removeEventListener('visibilitychange', pause)
    }
  }, [])

  const stage = props.next
  const canInteract = status === 'ready' && stage !== undefined && nearby === stage.id
  const destination = stations.find(({ id }) => id === stage?.id)
  const location = stations.find(({ id }) => id === nearby)

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || status !== 'ready') return
    const key = arrowKeys.get(event.key)
    if (key) {
      event.preventDefault()
      active.current.add(key)
    }
    if (event.key === 'Enter' && canInteract && stage && !event.repeat) {
      event.preventDefault()
      active.current.clear()
      props.onOpen(stage, event.currentTarget)
    }
  }

  function keyUp(event: KeyboardEvent<HTMLElement>) {
    const key = arrowKeys.get(event.key)
    if (key) active.current.delete(key)
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, direction: Direction) {
    if (event.button !== 0 || status !== 'ready') return
    event.currentTarget.setPointerCapture(event.pointerId)
    active.current.add(direction)
  }

  return (
    <section className="campus-panel" aria-label="Exploration du campus">
      <div className="scene-shell">
        <div
          ref={input}
          data-position={`${initialPosition.current.x.toFixed(1)},${initialPosition.current.y.toFixed(1)}`}
          data-game-state={status}
          role="region"
          tabIndex={0}
          aria-label="Zone de jeu"
          aria-describedby="scene-controls scene-destination"
          className="scene"
          style={{ backgroundImage: `url("${campusArt}")` }}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          onBlur={() => active.current.clear()}
          onClick={(event) => event.currentTarget.focus()}
        >
          <div className="scene-canvas" ref={host} />
          <div className="scene-tag"><Icon name="pin" size={15} /> Campus provisoire</div>
          {status === 'loading' && <p className="scene-message" role="status">Chargement du campus…</p>}
        </div>
        <div className="scene-location" id="scene-destination" aria-live="polite">
          <span className="location-icon"><Icon name="pin" size={19} /></span>
          <div>
            <span className="micro-label">{canInteract ? 'Sur place' : 'Destination'}</span>
            <strong>{destination?.label ?? 'Mission terminée'}</strong>
          </div>
          {stage && <button
            type="button"
            className="button scene-action"
            aria-disabled={!canInteract}
            onClick={(event) => {
              if (canInteract) props.onOpen(stage, event.currentTarget)
            }}
          >{canInteract ? 'Ouvrir l’étape' : 'Approche-toi du repère'}</button>}
        </div>
      </div>
      {status === 'error' && <p className="notice" role="alert">Le campus n’a pas pu se charger. <button className="text-button" onClick={props.onAccessible}>Continuer sans jeu</button></p>}
      <div className="scene-help" id="scene-controls">
        <span className="keyboard-help"><Icon name="keyboard" size={21} /> <span><kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> se déplacer <span className="help-divider">·</span> <kbd>Entrée</kbd> interagir</span></span>
        <span className="touch-help">Maintiens une flèche pour avancer.</span>
        <span className="nearby-label">{location ? `Près de ${location.label}` : 'Cour du campus'}</span>
      </div>
      <div className="direction-pad" aria-label="Commandes de déplacement">
        {controls.map(({ direction, symbol, label }) => <button
          key={direction}
          type="button"
          className="direction-button"
          aria-label={label}
          disabled={status !== 'ready'}
          onPointerDown={(event) => pointerDown(event, direction)}
          onPointerUp={() => active.current.delete(direction)}
          onLostPointerCapture={() => active.current.delete(direction)}
          onPointerCancel={() => active.current.delete(direction)}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault()
              active.current.add(direction)
            }
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter') active.current.delete(direction)
          }}
          onBlur={() => active.current.delete(direction)}
        >{symbol}</button>)}
      </div>
    </section>
  )
}
