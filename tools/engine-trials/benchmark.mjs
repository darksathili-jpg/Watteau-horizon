import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { git, sha256 } from '../harness/checks.mjs'
import { serveTrials } from './serve.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const experiment = resolve(root, 'experiments/engine-trials')
const protocol = JSON.parse(await readFile(resolve(root, 'production/engine-protocol.json')))
const { values } = parseArgs({
  options: { out: { type: 'string' }, dist: { type: 'string' }, smoke: { type: 'boolean', default: false }, case: { type: 'string' }, 'cold-only': { type: 'boolean', default: false }, 'motion-only': { type: 'boolean', default: false }, video: { type: 'boolean', default: false } },
})
const out = resolve(values.out ?? `quality-results/engine-trials-${Date.now()}`)
const dist = resolve(values.dist ?? resolve(experiment, 'dist'))
await mkdir(dirname(out), { recursive: true })
await mkdir(out)
const probes = values['motion-only'] ? 0 : values.smoke ? 1 : protocol.minimumColdRunsPerCombination
const seconds = values.smoke ? 3 : protocol.movementSampleSeconds
const labels = { phaser: 'Phaser Canvas', three: 'Three.js', godot: 'Godot 4 Web' }
const engines = Object.keys(labels)
const profiles = {
  desktop: { viewport: { width: 1440, height: 960 }, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}
if ((values['cold-only'] || values['motion-only']) && (!values.case || values.smoke || values.video || (values['cold-only'] && values['motion-only']))) {
  throw new Error('Une reprise ciblée exige --case et une seule phase, sans --smoke ni --video.')
}
if (values.case && (!(values.smoke || values['cold-only'] || values['motion-only']) || !engines.some((engine) => Object.keys(profiles).some((profile) => values.case === `${engine}-${profile}`)))) {
  throw new Error('Un cas ciblé exige --smoke, --cold-only ou --motion-only et un couple moteur-profil connu.')
}
const noMatch = (engine, profile) => values.case && values.case !== `${engine}-${profile}`
const storageKey = (engine) => `watteau-engine-trials:v1:${engine}`
const readySelector = '#world[data-state="ready"], #world[data-state="failed"]'
const read = (page) => page.evaluate(() => window.watteauTrial.read())
const rounded = (value) => Math.round(value * 100) / 100
const quantile = (samples, fraction) => {
  if (!samples.length) return null
  const sorted = samples.toSorted((a, b) => a - b)
  const rank = Math.ceil(fraction * sorted.length) - 1
  if (fraction === 0.5 && sorted.length % 2 === 0) return rounded((sorted[rank] + sorted[rank + 1]) / 2)
  return rounded(sorted[rank])
}

const server = await serveTrials(dist)
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const report = {
  schema: 1,
  label: values.smoke ? 'smoke' : values['cold-only'] ? 'preselection-cold-check'
    : values['motion-only'] ? 'preselection-motion-check' : 'preselection-emulated',
  revision: (await git(root, 'rev-parse', 'HEAD')).toString().trim(),
  sceneSha256: sha256(await readFile(resolve(experiment, 'scene.json'))),
  versions: { phaser: '3.90.0', three: '0.187.0', godot: '4.7.2-stable', chromium: browser.version() },
  host: { platform: process.platform, architecture: process.arch, mode: 'Chromium headless, ANGLE/SwiftShader, loopback HTTP gzip, DPR 1' },
  minimumColdRunsPerCombination: probes,
  requestedMotionSeconds: values['cold-only'] ? null : seconds,
  assets: server.sizes, cases: {},
}
const metricsPath = resolve(out, 'measurements.json')
const checkpoint = () => writeFile(metricsPath, JSON.stringify(report, null, 2) + '\n')

async function freshContext(engine, profile, video = false, session) {
  const viewport = profiles[profile].viewport
  const context = await browser.newContext({
    ...profiles[profile], ...(session ? { extraHTTPHeaders: { 'X-Watteau-Trial-Session': session } } : {}), locale: 'fr-FR', timezoneId: 'Europe/Paris', deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    ...(video ? { recordVideo: { dir: resolve(out, 'video-tmp'), size: viewport } } : {}),
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const errors = []
  const warnings = []
  const finished = []
  page.on('pageerror', (error) => errors.push({ type: 'exception', message: error.message }))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ type: 'console', message: message.text() })
    if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('requestfailed', (request) => errors.push({ type: 'network', url: new URL(request.url()).pathname, message: request.failure()?.errorText }))
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push({ type: 'http', url: new URL(response.url()).pathname, message: String(response.status()) })
  })
  context.on('requestfinished', (request) => { if (request.url().startsWith(server.url)) finished.push(request) })
  const launch = () => page.goto(server.url + `?engine=${engine}&measure=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  return { page, context, errors, warnings, finished, launch }
}

async function ready(page) {
  const indicator = page.locator(readySelector)
  await indicator.waitFor({ state: 'attached', timeout: 60000 })
  const state = await indicator.getAttribute('data-state')
  if (state !== 'ready') throw new Error(await page.locator('#loading').innerText())
  const result = await read(page)
  assert.ok(Number.isFinite(result.readyAt) && result.readyAt > 0)
  return result.readyAt
}

async function cold(engine, profile) {
  const session = randomUUID()
  const browserCase = await freshContext(engine, profile, false, session)
  try {
    await browserCase.launch()
    const readyMs = await ready(browserCase.page)
    await browserCase.page.waitForLoadState('networkidle', { timeout: 12000 })
    const loaded = await Promise.all(browserCase.finished.map(async (request) => {
      const sizes = await request.sizes()
      return { url: new URL(request.url()).pathname, body: sizes.responseBodySize, headers: sizes.responseHeadersSize }
    }))
    const serverRequests = server.requests(session)
    const servedBodyBytes = serverRequests.filter((request) => request.finished).reduce((sum, item) => sum + item.declaredBodyBytes, 0)
    const complete = engine !== 'godot' || loaded.some(({ url, body }) => url.endsWith('/index.wasm') && body > 0)
    return {
      status: complete && !browserCase.errors.length ? 'measured' : 'incomplete',
      reason: complete ? undefined : 'Le navigateur ne fournit pas de taille complète pour le WASM.',
      readyMs: rounded(readyMs),
      transferBytes: complete ? loaded.reduce((sum, item) => sum + item.body + item.headers, 0) : null,
      bodyBytes: complete ? loaded.reduce((sum, item) => sum + item.body, 0) : null,
      servedBodyBytes, serverRequests, resources: loaded, errors: [...browserCase.errors], warnings: [...browserCase.warnings],
    }
  } catch (error) {
    return { status: 'failed', reason: error.message, errors: [...browserCase.errors], warnings: [...browserCase.warnings] }
  } finally {
    await browserCase.context.close()
  }
}

async function hold(page, key, condition, options = {}) {
  const { touch, timeout = 23000 } = options
  let end
  if (touch) {
    const button = page.locator(`[data-direction="${key.slice(5).toLowerCase()}"]`)
    await button.scrollIntoViewIfNeeded()
    const box = await button.boundingBox()
    assert.ok(box, 'Commande tactile hors du viewport.')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
    end = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.keyboard.down(key)
    end = () => page.keyboard.up(key)
  }
  try {
    await page.waitForFunction(({ axis, target, greater, stopped }) => {
      const state = window.watteauTrial.read()
      const reached = greater ? state[axis] >= target : state[axis] <= target
      return reached && (!stopped || !state.walking)
    }, condition, { timeout })
  } catch (error) {
    const state = await read(page).catch(() => null)
    const place = state ? `x=${rounded(state.x)}, z=${rounded(state.z)}` : 'position indisponible'
    throw new Error(`${key}, cible ${condition.axis}=${condition.target}, ${place}. ${error.message}`)
  } finally {
    await end()
  }
}
const dest = (axis, target, greater) => ({ axis, target, greater })

const route = [
  ['ArrowUp', dest('z', -3.2, false)], ['ArrowRight', dest('x', 8.7, true)],
  ['ArrowDown', dest('z', 5.5, true)], ['ArrowLeft', dest('x', -9, false)],
]

async function motion(engine, profile) {
  const browserCase = await freshContext(engine, profile)
  const { page } = browserCase
  try {
    await browserCase.launch()
    await ready(page)
    await page.waitForLoadState('networkidle', { timeout: 12000 })
    await page.locator('#world').focus()
    await page.evaluate(() => window.watteauTrial.startSample())
    const end = performance.now() + seconds * 1000
    let segments = 0
    while (performance.now() < end - 30) {
      const [key, target] = route[segments % route.length]
      const remaining = end - performance.now()
      try {
        await hold(page, key, target, { timeout: Math.max(1, Math.min(55000, remaining)) })
        segments += 1
      } catch (error) {
        if (performance.now() < end - 100) throw error
        break
      }
    }
    const timestamps = await page.evaluate(() => window.watteauTrial.finishSample())
    const deltas = timestamps.slice(1).map((value, index) => value - timestamps[index])
    assert.ok(deltas.length > 1, 'Aucune série de rendu exploitable.')
    const observedSeconds = rounded((timestamps.at(-1) - timestamps[0]) / 1000)
    const series = `${engine}-${profile}-frames.json`
    await writeFile(resolve(out, series), JSON.stringify({ timestamps, deltas }) + '\n')
    return {
      status: 'measured', observedSeconds, completedSegments: segments, frameCount: deltas.length,
      medianMs: quantile(deltas, 0.5), p95Ms: quantile(deltas, 0.95), maxMs: rounded(Math.max(...deltas)),
      over50ms: deltas.filter((ms) => ms > 50).length, series,
      errors: [...browserCase.errors], warnings: [...browserCase.warnings],
    }
  } catch (error) {
    return { status: 'failed', reason: error.message, errors: [...browserCase.errors], warnings: [...browserCase.warnings] }
  } finally {
    await browserCase.context.close()
  }
}

async function finishStation(page, index, keyboard) {
  if (keyboard) {
    await page.locator('#world').focus()
    await page.keyboard.press('Enter')
  } else await page.getByRole('button', { name: 'Ouvrir l’étape' }).click()
  const dialogue = page.getByRole('dialog', { name: ['Comprendre le besoin', 'Concevoir une interface', 'Tester et améliorer'][index] })
  await dialogue.waitFor()
  await dialogue.getByRole('radio').nth(index).check()
  await dialogue.getByRole('button', { name: 'Vérifier mon choix' }).click()
  await dialogue.getByRole('button', { name: 'Confirmer l’étape' }).click()
  await dialogue.waitFor({ state: 'hidden' })
  assert.equal((await read(page)).active, index + 1)
}

async function functional(engine, profile) {
  const name = `${engine}-${profile}`
  const browserCase = await freshContext(engine, profile)
  const { page, context } = browserCase
  const checks = []
  const snapshots = []
  let reason
  let axe
  let screenshotFailure
  try {
    await browserCase.launch()
    await ready(page)
    await page.screenshot({ path: resolve(out, `${name}-spawn.png`), fullPage: true })
    snapshots.push(`${name}-spawn.png`)
    const touch = profile === 'mobile' ? await context.newCDPSession(page) : null
    const keyboard = !touch
    if (keyboard) await page.locator('#world').focus()
    const walking = (key, condition) => hold(page, key, condition, { touch })
    await page.evaluate(() => localStorage.setItem('watteau-horizon:benchmark-sentinel', 'Valeur synthétique indépendante'))
    await walking('ArrowRight', dest('x', -4.15, true))
    await walking('ArrowUp', { ...dest('z', 3.37, false), stopped: true })
    const blocked = await read(page)
    assert.ok(blocked.z >= 3.14 - 0.0001 && blocked.z <= 3.37, `Collision inattendue à z=${blocked.z}.`)
    checks.push('déplacement et collision du premier bac')
    await walking('ArrowLeft', dest('x', -9, false))
    await walking('ArrowUp', dest('z', 0.20, false))
    await finishStation(page, 0, keyboard)
    await walking('ArrowUp', dest('z', -3.20, false))
    await walking('ArrowRight', dest('x', -0.75, true))
    await page.locator('#world').scrollIntoViewIfNeeded()
    await page.screenshot({ path: resolve(out, `${name}-atelier.png`), fullPage: true })
    snapshots.push(`${name}-atelier.png`)
    await finishStation(page, 1, keyboard)
    await walking('ArrowRight', dest('x', 8.7, true))
    await walking('ArrowDown', dest('z', 1.7, true))
    await finishStation(page, 2, keyboard)
    checks.push('trois repères activés dans l’ordre')
    await page.getByRole('button', { name: 'Réduire les mouvements' }).click()
    if (keyboard) await page.locator('#world').focus()
    await walking('ArrowDown', dest('z', 2.4, true))
    const reduced = await read(page)
    assert.equal(reduced.reduced, true)
    assert.equal(reduced.step, 0)
    assert.equal(reduced.cameraZ, reduced.z)
    checks.push('gait neutralisé et caméra directe avec la réduction de mouvement')
    await page.getByRole('textbox', { name: 'Une idée à retenir' }).fill('Je souhaite comparer deux idées. Note synthétique de recette.')
    await page.getByRole('button', { name: 'Enregistrer ma note' }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready(page)
    assert.equal((await read(page)).active, 3)
    assert.equal(await page.getByRole('textbox', { name: 'Une idée à retenir' }).inputValue(), 'Je souhaite comparer deux idées. Note synthétique de recette.')
    checks.push('reprise du carnet et des trois étapes')
    await page.getByRole('button', { name: 'Effacer les données de l’essai' }).click()
    await page.getByRole('button', { name: 'Confirmer l’effacement' }).click()
    const keys = await page.evaluate((trial) => [localStorage.getItem(trial), localStorage.getItem('watteau-horizon:benchmark-sentinel')], storageKey(engine))
    assert.deepEqual(keys, [null, 'Valeur synthétique indépendante'])
    assert.equal((await read(page)).active, 0)
    checks.push('effacement isolé au moteur')
    await page.getByRole('button', { name: 'Sans jeu', exact: true }).click()
    assert.equal((await read(page)).accessible, true)
    assert.equal(await page.locator('#world').isVisible(), false)
    for (let index = 0; index < 3; index += 1) await finishStation(page, index, false)
    checks.push('trois étapes équivalentes sans rendu')
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    axe = result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) }))
    assert.deepEqual(axe, [])
    checks.push('aucun écart axe dans le parcours sans jeu testé')
    const noGameStart = browserCase.finished.length
    await page.goto(server.url + `?engine=${engine}&mode=accessible&measure=1`, { waitUntil: 'networkidle' })
    assert.equal((await read(page)).accessible, true)
    assert.equal(await page.locator('#surface canvas, #surface iframe').count(), 0)
    assert.ok(browserCase.finished.slice(noGameStart).every((request) => !/\/(?:render-(?:phaser|three|godot)-|godot\/)/.test(request.url())))
    checks.push('entrée sans jeu sans téléchargement d’un moteur')
    assert.deepEqual(browserCase.errors, [])
  } catch (error) {
    reason = error.message
    try {
      await page.screenshot({ path: resolve(out, `${name}-failure.png`), fullPage: true })
      snapshots.push(`${name}-failure.png`)
    } catch (screenshotProblem) {
      screenshotFailure = screenshotProblem.message
    }
  } finally {
    await context.close()
  }
  return {
    status: reason ? 'failed' : 'passed', reason, screenshotFailure, inputs: profile === 'mobile' ? 'tactile CDP' : 'clavier',
    checks, axe, snapshots, errors: [...browserCase.errors], warnings: [...browserCase.warnings],
  }
}

async function captureVideo(engine, profile) {
  const { context, page, launch, errors } = await freshContext(engine, profile, true)
  const video = page.video()
  let reason
  try {
    await launch()
    await ready(page)
    await page.locator('#world').focus()
    await hold(page, 'ArrowUp', dest('z', 0.20, false))
    await finishStation(page, 0, true)
    await hold(page, 'ArrowUp', dest('z', -3.20, false))
    await hold(page, 'ArrowRight', dest('x', -0.70, true))
    await page.getByRole('button', { name: 'Ouvrir l’étape' }).click()
    await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(1200)
  } catch (error) {
    reason = error.message
  } finally {
    await context.close()
  }
  const file = `${engine}-${profile}.webm`
  try {
    await video.saveAs(resolve(out, file))
    await video.delete()
    return { status: reason ? 'failed' : 'recorded', file, reason, errors }
  } catch (error) {
    return { status: 'failed', reason: error.message, errors }
  }
}

try {
  const context = await browser.newContext()
  const page = await context.newPage()
  report.host.webgl = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return null
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  })
  await context.close()
  const available = { phaser: true, three: true, godot: Boolean(server.sizes['/engine-trials/godot/index.wasm']) }
  for (const [profile, settings] of Object.entries(profiles)) {
    for (const engine of engines) {
      if (noMatch(engine, profile)) continue
      const item = { engine, profile, viewport: settings.viewport, cold: [] }
      if (!available[engine]) item.blocked = 'Export Web Godot mono-thread absent du paquet.'
      report.cases[`${engine}-${profile}`] = item
    }
  }
  for (let attempt = 0; attempt < probes; attempt += 1) {
    const order = engines.slice(attempt % engines.length).concat(engines.slice(0, attempt % engines.length))
    for (const profile of Object.keys(profiles)) {
      for (const engine of order) {
        const item = report.cases[`${engine}-${profile}`]
        if (!item || item.blocked) continue
        const observation = await cold(engine, profile)
        item.cold.push(observation)
        console.log(`${engine} ${profile} · départ ${attempt + 1}/${probes} · ${observation.readyMs ?? observation.reason}`)
        await checkpoint()
      }
    }
  }
  for (const item of Object.values(report.cases)) {
    if (item.blocked) continue
    if (values['motion-only']) {
      item.motion = await motion(item.engine, item.profile)
      console.log(`${item.engine} ${item.profile} · mouvement ${item.motion.status} · p95 ${item.motion.p95Ms ?? item.motion.reason}`)
      await checkpoint()
      continue
    }
    const valid = item.cold.filter(({ status }) => status === 'measured')
    item.startup = {
      measured: valid.length, medianMs: quantile(valid.map(({ readyMs }) => readyMs), 0.5),
      medianTransferBytes: quantile(valid.map(({ transferBytes }) => transferBytes), 0.5),
      maxTransferBytes: valid.length ? Math.max(...valid.map(({ transferBytes }) => transferBytes)) : null,
    }
    if (valid.length === 0 || values['cold-only']) continue
    item.functional = await functional(item.engine, item.profile)
    console.log(`${item.engine} ${item.profile} · parcours ${item.functional.status} · ${item.functional.reason ?? item.functional.checks.length + ' contrôles'}`)
    await checkpoint()
    item.motion = await motion(item.engine, item.profile)
    console.log(`${item.engine} ${item.profile} · mouvement ${item.motion.status} · p95 ${item.motion.p95Ms ?? item.motion.reason}`)
    await checkpoint()
  }
  if (values.video) {
    for (const item of Object.values(report.cases)) {
      if (item.startup?.measured) {
        item.video = await captureVideo(item.engine, item.profile)
        console.log(`${item.engine} ${item.profile} · vidéo ${item.video.status}`)
        await checkpoint()
      }
    }
  }
} finally {
  try {
    await checkpoint()
    await browser.close()
  } finally {
    await server.close()
  }
}

const failures = Object.values(report.cases).filter((item) => {
  if (item.blocked) return Boolean(values.case)
  if (values['motion-only']) return item.motion?.status !== 'measured' || item.motion.errors.length > 0
  return item.startup?.measured !== probes
    || (!values['cold-only'] && (item.functional?.status !== 'passed' || item.motion?.status !== 'measured'))
    || (values.video && item.video?.status !== 'recorded')
    || [...item.cold, item.motion, item.video].some((part) => part?.errors.length)
})
const real = engines.filter((engine) => Object.keys(profiles).every((profile) => report.cases[`${engine}-${profile}`]?.functional?.status === 'passed'))
console.log(`Preuves dans ${out}. Moteurs avec deux parcours validés : ${real.join(', ')}.`)
if (failures.length || (!values.case && real.length < 2)) process.exitCode = 1
