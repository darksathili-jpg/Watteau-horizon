import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { serveSlice, csp } from './serve.mjs'

const root = resolve('experiments/artistic-slice')
const target = process.argv[2]
if (!target) throw new Error('Indiquer un dossier de preuve neuf.')
const out = resolve(target)
await mkdir(out, { recursive: true })
const selection = process.argv[3] ?? 'all'
const server = await serveSlice(resolve(root, 'dist'))
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const desktop = { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 }
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
const catalogue = 'Comparer les formations'
const receipt = { startedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), browser: browser.version(), cases: [] }
const url = (options = '') => server.url + '?instrument=1' + options
const shot = (page, name) => page.screenshot({ path: resolve(out, name + '.png') })
const state = (page) => page.evaluate(() => window.watteauP4?.observe())
const loaded = (page) => expect.poll(() => state(page), { timeout: 35_000 }).toMatchObject({ animation: 'Idle' })
const focusScene = (page) => page.getByLabel('Scène jouable. Flèches pour se déplacer').focus()
const none = (page) => page.getByRole('navigation', { name: 'Navigation du prototype' })
const compare = (page) => none(page).getByRole('button', { name: 'Formations', exact: true }).click()
const interact = (page) => page.getByRole('button', { name: 'Interagir', exact: true })
const close = (page) => page.getByRole('button', { name: 'Fermer', exact: true }).click()

async function hold(page, key, until, timeout = 40_000) {
  await page.keyboard.down(key)
  try {
    await expect.poll(async () => until(await state(page)), { timeout, intervals: [80, 100, 140] }).toBe(true)
  } finally {
    await page.keyboard.up(key)
  }
}
async function choose(page, option, wrong) {
  if (wrong !== undefined) {
    await page.getByRole('radio').nth(wrong).check()
    await page.getByRole('button', { name: 'Vérifier mon choix' }).click()
    await expect(page.getByRole('button', { name: 'Terminer l’étape' })).toHaveCount(0)
    await expect(page.getByRole('dialog').getByRole('status')).not.toBeEmpty()
  }
  await page.getByRole('radio').nth(option).check()
  await page.getByRole('button', { name: 'Vérifier mon choix' }).click()
  await page.getByRole('button', { name: 'Terminer l’étape' }).click()
}
async function axe(page, label, results) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  results.push({ label, violations: report.violations, incomplete: report.incomplete.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) })), passes: report.passes.length })
  assert.deepEqual(report.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) })), [])
}
async function run(id, config, perform) {
  if (selection !== 'all' && !selection.split(',').includes(id)) return
  const context = await browser.newContext(config)
  const test = { id, status: 'PASS', http: [], errors: [], observations: {}, axe: [] }
  receipt.cases.push(test)
  await context.tracing.start({ screenshots: false, snapshots: true, sources: true })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const origin = new URL(server.url).origin
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) test.http.push({ method: request.method(), url: request.url() })
  })
  page.on('pageerror', (error) => test.errors.push(error.message))
  page.on('console', (entry) => { if (entry.type() === 'error') test.errors.push(entry.text()) })
  try {
    await perform(page, test, context)
    assert(test.http.every(({ url, method }) => new URL(url).origin === origin && method === 'GET'), 'Échange réseau sortant ou écriture réseau')
    assert.deepEqual(test.errors, [], 'Erreurs console ou erreurs de page')
  } catch (error) {
    test.status = 'FAIL'
    test.error = error.stack
    await shot(page, `failure-${id}`).catch(() => {})
  } finally {
    await context.tracing.stop({ path: resolve(out, id + '-trace.zip') })
    await context.close()
  }
  console.log(id, test.status, test.error?.split('\n')[0] ?? '')
}

try {
  await run('desktop', desktop, async (page, test) => {
    const response = await page.goto(url(), { waitUntil: 'networkidle' })
    assert.equal((await response.allHeaders())['content-security-policy'], csp)
    await loaded(page)
    await expect(interact(page)).toBeDisabled()
    await axe(page, 'scène ordinateur', test.axe)
    await shot(page, '01-campus-ordinateur')
    test.observations.depart = await state(page)
    assert(test.observations.depart.textures >= 40, 'Les textures du campus et des personnages doivent être chargées.')
    await focusScene(page)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.keyboard.down('ArrowUp')
    await expect.poll(async () => (await state(page)).animation).toBe('Walk')
    await page.keyboard.up('ArrowUp')
    await hold(page, 'ArrowDown', (value) => value.clipsPlayed.avatar.includes('Turn'))
    await page.keyboard.down('Shift')
    await hold(page, 'ArrowUp', (value) => value.z < .01 && value.clipsPlayed.avatar.includes('Run'))
    await page.keyboard.up('Shift')
    await hold(page, 'ArrowUp', (value) => value.z < -1.12)
    await hold(page, 'ArrowUp', (value) => value.z < -1.26)
    const collision = await state(page)
    assert(collision.z > -1.32 && collision.z < -1.26)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect.poll(async () => (await state(page)).antoine).toBe('Dialogue')
    await expect.poll(async () => (await state(page)).clipsPlayed.avatar.includes('Interact'), { intervals: [30] }).toBe(true)
    await axe(page, 'dialogue ordinateur', test.axe)
    await shot(page, '02-dialogue-ordinateur')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel('Scène jouable. Flèches pour se déplacer')).toBeFocused()
    await page.keyboard.press('Enter')
    await choose(page, 0, 1)
    await hold(page, 'ArrowLeft', (value) => value.x < -6.75)
    await hold(page, 'ArrowUp', (value) => value.z < -4.6)
    await expect(interact(page)).toBeEnabled()
    await shot(page, '03-atelier-ordinateur')
    await page.keyboard.press('Enter')
    await choose(page, 1)
    await hold(page, 'ArrowRight', (value) => value.x > 7.5)
    await hold(page, 'ArrowUp', (value) => value.z < -5.8)
    await expect(interact(page)).toBeEnabled()
    await page.keyboard.press('Enter')
    await choose(page, 2)
    await expect(page.getByText('3 / 3', { exact: true })).toBeVisible()
    test.observations.arrival = await state(page)
    assert(test.observations.arrival.camera[0] > 6)
    assert(test.observations.arrival.clipsPlayed.avatar.includes('Interact'))
    assert(test.observations.arrival.clipsPlayed.antoine.includes('Dialogue'))
    assert(test.observations.arrival.feet.every((foot) => foot && foot.every(Number.isFinite)))
    await page.keyboard.press('m')
    await expect.poll(async () => (await state(page)).camera[1], { timeout: 5000 }).toBeGreaterThan(25)
    await shot(page, '04-vue-ensemble')
    await page.keyboard.press('m')
    await expect.poll(async () => (await state(page)).camera[1]).toBeLessThan(2.5)
    await page.getByRole('button', { name: /Carnet/ }).click()
    await page.getByRole('textbox', { name: 'Qu’est-ce qui m’a intéressé ?' }).fill('Exemple fictif P4 · vérifier un prototype.')
    await page.getByRole('button', { name: 'Enregistrer ma réflexion' }).click()
    await expect(page.getByText('Réflexion enregistrée dans le carnet.')).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporter le carnet' }).click(),
    ])
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'))
    assert.equal(exported.completed.length, 3)
    assert.equal(exported.reflection.interest, 'Exemple fictif P4 · vérifier un prototype.')
    await page.reload({ waitUntil: 'networkidle' })
    await loaded(page)
    await expect(page.getByText('3 / 3', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Carnet/ }).click()
    await expect(page.getByRole('textbox', { name: 'Qu’est-ce qui m’a intéressé ?' })).toHaveValue(exported.reflection.interest)
    await page.evaluate(() => localStorage.setItem('watteau-horizon:v1', 'témoin-fictif'))
    await page.getByRole('button', { name: 'Effacer les données locales' }).click()
    await page.getByRole('button', { name: 'Effacer', exact: true }).click()
    await expect(page.getByText('0 / 3 étapes terminées.')).toBeVisible()
    const remaining = await page.evaluate(() => ({ main: localStorage.getItem('watteau-horizon:v1'), keys: Object.keys(localStorage) }))
    assert.deepEqual(remaining, { main: 'témoin-fictif', keys: ['watteau-horizon:v1'] })
    test.observations.storageAfterErase = remaining.keys
    test.observations.collision = collision
  })

  await run('tactile', mobile, async (page, test, context) => {
    await page.goto(url(), { waitUntil: 'networkidle' })
    await loaded(page)
    await shot(page, '05-campus-mobile')
    await axe(page, 'scène mobile', test.axe)
    const controller = await context.newCDPSession(page)
    const box = await page.getByRole('button', { name: 'Avancer', exact: true }).boundingBox()
    await controller.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
    try { await expect(interact(page)).toBeEnabled({ timeout: 25_000 }) }
    finally { await controller.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
    await interact(page).tap()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, '06-dialogue-mobile')
    await choose(page, 0)
    await expect(page.getByText('1 / 3', { exact: true })).toBeVisible()
    test.observations.arrival = await state(page)
  })

  await run('accessible', { ...desktop, reducedMotion: 'reduce' }, async (page, test) => {
    await page.goto(url('&mode=accessible'), { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Explorer sans jeu' })).toBeVisible()
    assert(!test.http.some(({ url }) => /engine-|\.glb/.test(url)))
    await axe(page, 'parcours sans moteur', test.axe)
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Réduire le mouvement' })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused()
    for (const option of [0, 1, 2]) {
      await page.getByRole('button', { name: 'Ouvrir', exact: true }).click()
      await choose(page, option)
    }
    await expect(page.getByText('3 / 3 étapes', { exact: true })).toBeVisible()
    await shot(page, '07-sans-jeu')
    await compare(page)
    await expect(page.getByRole('heading', { name: catalogue, exact: true })).toBeFocused()
    await expect(page.getByRole('combobox', { name: 'Choisir la formation A' }).locator('option')).toHaveCount(17)
    await page.getByRole('combobox', { name: 'Choisir la formation A' }).selectOption({ index: 1 })
    await page.getByRole('combobox', { name: 'Choisir la formation B' }).selectOption({ index: 2 })
    await page.locator('.provenance summary').first().click()
    await expect(page.getByRole('link', { name: 'Voir la fiche Parcoursup', exact: true })).toHaveCount(2)
    await expect(page.getByText('Licence Ouverte v2.0', { exact: false }).first()).toBeVisible()
    await axe(page, 'comparateur et provenance', test.axe)
    await shot(page, '08-comparateur')
    await page.setViewportSize({ width: 320, height: 768 })
    const width = await page.evaluate(() => ({ view: innerWidth, content: document.documentElement.scrollWidth }))
    assert.equal(width.view, width.content)
    await expect(page.getByRole('combobox', { name: 'Choisir la formation B' })).toBeVisible()
    test.observations.reflow = width
    await shot(page, '09-comparateur-320')
  })

  await run('composition', { ...desktop, viewport: { width: 1600, height: 900 } }, async (page, test) => {
    await page.goto(url(), { waitUntil: 'networkidle' })
    await loaded(page)
    await expect(page.getByText('Campus fictif', { exact: false }).first()).toBeVisible()
    test.observations.cadrage = await state(page)
    await shot(page, '00-cadrage-16-9')
  })

  await run('repli', desktop, async (page, test) => {
    // Route fulfils malformed bytes under a successful status, so no synthetic console errors are ignored.
    await page.route('**/avatar.glb', (route) => route.fulfill({ contentType: 'model/gltf-binary', body: 'GLB invalide' }))
    await page.goto(url(), { waitUntil: 'networkidle' })
    await expect(page.getByText(/La 3D est indisponible/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Explorer sans jeu' })).toBeVisible()
    await page.getByRole('button', { name: 'Ouvrir', exact: true }).click()
    await choose(page, 0)
    await expect(page.getByText('1 / 3 étapes', { exact: true })).toBeVisible()
    await shot(page, '10-repli-glb')
  })

  await run('mouvement-reduit', { ...desktop, reducedMotion: 'reduce' }, async (page, test) => {
    await page.goto(url(), { waitUntil: 'networkidle' })
    await loaded(page)
    await focusScene(page)
    await page.keyboard.press('m')
    await expect.poll(async () => (await state(page)).camera[1]).toBe(27)
    await page.keyboard.press('m')
    await expect.poll(async () => (await state(page)).camera[1]).toBe(1.62)
    await page.keyboard.down('Shift')
    await hold(page, 'ArrowUp', (value) => value.z < 7 && value.animation === 'Walk')
    await page.keyboard.up('Shift')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('checkbox', { name: 'Réduire le mouvement' })).toBeChecked()
    await close(page)
    await expect(page.getByLabel('Scène jouable. Flèches pour se déplacer')).toBeFocused()
    test.observations.final = await state(page)
  })
} finally {
  await browser.close()
  await server.close()
  receipt.finishedAt = new Date().toISOString()
  await writeFile(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}
if (!receipt.cases.length || receipt.cases.some(({ status }) => status !== 'PASS')) process.exitCode = 1
