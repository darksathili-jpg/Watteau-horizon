import './style.css'
import { stages } from '../../src/domain/mission.ts'
import { canInteract, fresh, move, persisted, resetFrom, scene } from './model.mjs'

const engines = {
  phaser: { label: 'Phaser Canvas', load: () => import('./render-phaser.mjs') },
  three: { label: 'Three.js', load: () => import('./render-three.mjs') },
  godot: { label: 'Godot 4 Web', load: () => import('./render-godot.mjs') },
}
const params = new URLSearchParams(location.search)
const requested = params.get('engine')
const engine = Object.hasOwn(engines, requested) ? requested : 'three'
const storageKey = `watteau-engine-trials:v1:${engine}`
const $ = (name) => document.getElementById(name)
const stage = $('world')
const form = $('question-form')
const dialog = $('dialog')
const eraseDialog = $('erase-dialog')
const reducePreference = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const arrowMap = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }
const held = new Map()
let state = initial()
let accessible = params.get('mode') === 'accessible'
let starting = false
let initialized = false
let readyAt = null
let renderer
let collecting = false
let frames = []
let lastEligibility = null

$('engine-title').textContent = engines[engine].label
document.querySelector(`a[href="?engine=${engine}"]`).setAttribute('aria-current', 'page')

function initial() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey))
    if (stored?.version === 1) return resetFrom(stored)
  } catch {
    // Storage may be unavailable in a browser profile.
  }
  return { ...fresh(), reduced: reducePreference() }
}

function store() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(persisted(state)))
    return true
  } catch {
    return false
  }
}

function visualState() {
  const { note, ...frame } = state
  return frame
}

function arrived() {
  const eligible = (readyAt !== null || accessible) && canInteract(state, accessible)
  if (eligible !== lastEligibility) {
    lastEligibility = eligible
    $('interact').disabled = !eligible
    $('step-status').textContent = state.active === stages.length ? 'Les trois étapes sont terminées.'
      : eligible ? 'Le repère est accessible.' : 'Approche-toi du repère indiqué.'
  }
}

function updateProgress() {
  const current = scene.stations[state.active]
  $('objective').textContent = current ? `Étape ${state.active + 1} sur 3 · ${current.label}` : 'Mission terminée'
  $('motion').setAttribute('aria-pressed', String(state.reduced))
  $('note').value = state.note
  $('progress').replaceChildren(...stages.map((item, index) => {
    const row = document.createElement('li')
    row.textContent = item.title
    if (index < state.active) {
      row.dataset.done = ''
      row.textContent += ' — terminé'
    } else if (index === state.active) row.setAttribute('aria-current', 'step')
    return row
  }))
  lastEligibility = null
  arrived()
}

function openStep() {
  if (!canInteract(state, accessible) || (!accessible && readyAt === null) || dialog.open) return
  const item = stages[state.active]
  held.clear()
  $('question-heading').textContent = item.title
  $('prompt').textContent = item.prompt
  $('feedback').textContent = ''
  delete form.dataset.correct
  form.querySelector('[type=submit]').textContent = 'Vérifier mon choix'
  $('choices-list').replaceChildren(...item.options.map((option, index) => {
    const label = document.createElement('label')
    const field = document.createElement('input')
    Object.assign(field, { type: 'radio', name: 'answer', value: String(index), required: true })
    label.append(field, document.createTextNode(option.label))
    return label
  }))
  dialog.showModal()
}

form.addEventListener('change', () => {
  delete form.dataset.correct
  $('feedback').textContent = ''
  form.querySelector('[type=submit]').textContent = 'Vérifier mon choix'
})
form.addEventListener('submit', (event) => {
  event.preventDefault()
  const option = stages[state.active]?.options[Number(new FormData(form).get('answer'))]
  if (!option) return
  if (option.advance && form.dataset.correct === 'true') {
    state.active += 1
    store()
    updateProgress()
    dialog.close()
    if ($('interact').disabled && !accessible) stage.focus()
    return
  }
  $('feedback').textContent = option.feedback
  if (option.advance) {
    form.dataset.correct = 'true'
    form.querySelector('[type=submit]').textContent = 'Confirmer l’étape'
  }
})
$('interact').addEventListener('click', openStep)
$('close').addEventListener('click', () => dialog.close())

$('motion').addEventListener('click', () => {
  state.reduced = !state.reduced
  $('motion').setAttribute('aria-pressed', String(state.reduced))
  store()
})
function updateMode() {
  document.body.dataset.accessible = String(accessible)
  $('mode').setAttribute('aria-pressed', String(accessible))
  $('mode').textContent = accessible ? 'Revenir au jeu' : 'Sans jeu'
  arrived()
}

$('mode').addEventListener('click', () => {
  accessible = !accessible
  held.clear()
  updateMode()
  if (!accessible) void launchRenderer()
})

$('note').addEventListener('input', () => { state.note = $('note').value })
$('save').addEventListener('click', () => {
  $('save-status').textContent = store() ? 'Note enregistrée sur cet appareil.' : 'Le stockage local est indisponible.'
})
$('erase').addEventListener('click', () => eraseDialog.showModal())
$('cancel-erase').addEventListener('click', () => eraseDialog.close())
$('confirm-erase').addEventListener('click', () => {
  try {
    localStorage.removeItem(storageKey)
    state = { ...fresh(), reduced: reducePreference() }
    held.clear()
    updateProgress()
    $('save-status').textContent = 'Données de l’essai effacées.'
  } catch {
    $('save-status').textContent = 'L’effacement local n’a pas abouti.'
  }
  eraseDialog.close()
})

stage.addEventListener('pointerdown', () => stage.focus({ preventScroll: true }))
stage.addEventListener('keydown', (event) => {
  if (accessible || dialog.open || readyAt === null) return
  if (arrowMap[event.key]) {
    event.preventDefault()
    held.set('key:' + event.key, arrowMap[event.key])
  } else if (event.key === 'Enter') {
    event.preventDefault()
    openStep()
  }
})
document.addEventListener('keyup', (event) => {
  if (held.delete('key:' + event.key)) store()
})
stage.addEventListener('blur', () => {
  for (const key of held.keys()) if (key.startsWith('key:')) held.delete(key)
})
for (const button of document.querySelectorAll('[data-direction]')) {
  const direction = button.dataset.direction
  button.addEventListener('pointerdown', (event) => {
    if (readyAt === null) return
    button.setPointerCapture(event.pointerId)
    held.set('pointer:' + event.pointerId, direction)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, (event) => {
      if (held.delete('pointer:' + event.pointerId)) store()
    })
  }
  button.addEventListener('keydown', (event) => {
    if (event.key !== ' ' || readyAt === null) return
    event.preventDefault()
    held.set('button:' + direction, direction)
  })
  button.addEventListener('keyup', () => {
    if (held.delete('button:' + direction)) store()
  })
  button.addEventListener('blur', () => held.delete('button:' + direction))
}
window.addEventListener('blur', () => { held.clear() })

function rendered() {
  const timestamp = performance.now()
  if (initialized && readyAt === null) {
    readyAt = timestamp
    stage.dataset.state = 'ready'
    $('loading').hidden = true
    arrived()
  }
  if (collecting && frames.length < 30_000) frames.push(timestamp)
}

function startFailure(error) {
  stage.dataset.state = 'failed'
  $('loading').textContent = `Chargement impossible (${error.message}). Le parcours sans jeu reste disponible.`
}

stage.dataset.state = accessible ? 'idle' : 'loading'
updateProgress()
updateMode()
window.watteauTrialFrame = JSON.stringify(visualState())
if (params.has('measure')) {
  window.watteauTrial = Object.freeze({
    read: () => ({ ...visualState(), readyAt, accessible }),
    startSample: () => { frames = []; collecting = true },
    finishSample: () => { collecting = false; return [...frames] },
  })
}

async function launchRenderer() {
  if (starting) return
  starting = true
  stage.dataset.state = 'loading'
  try {
    const module = await engines[engine].load()
    renderer = await module.createRenderer($('surface'), visualState, () => { initialized = true }, rendered, startFailure)
  } catch (error) {
    startFailure(error)
  }
}
if (!accessible) void launchRenderer()

let previous = performance.now()
function tick(timestamp) {
  if (!accessible && !dialog.open && !eraseDialog.open) {
    move(state, new Set(held.values()), (timestamp - previous) / 1000)
    const frame = visualState()
    if (engine === 'godot') window.watteauTrialFrame = JSON.stringify(frame)
    renderer?.draw?.(frame)
    arrived()
  }
  previous = timestamp
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
