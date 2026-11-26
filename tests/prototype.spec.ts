import AxeBuilder from '@axe-core/playwright'
import { expect, test as base } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { storageKey } from '../src/persistence/save'

const evidence = process.env.WATTEAU_EVIDENCE_DIR
const route = '/Watteau-horizon/'
const answers = [
  'Demander à quelques élèves comment ils découvrent les ateliers.',
  'Une liste lisible avec le nom, le lieu et l’heure de chaque atelier.',
  'Faire chercher un atelier sur mobile et au clavier, puis relever les obstacles.',
]

const test = base.extend<{ cleanPage: Page }>({
  cleanPage: async ({ page, baseURL }, provide) => {
    const issues: string[] = []
    page.on('pageerror', (error) => issues.push(error.message))
    page.on('console', (entry) => {
      if (entry.type() === 'error') issues.push(entry.text())
    })
    page.on('response', (response) => {
      if (response.status() >= 400) issues.push(`HTTP ${response.status()} ${response.url()}`)
    })
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.protocol === 'blob:' || url.protocol === 'data:') return
      if (url.origin !== new URL(baseURL!).origin || !url.pathname.startsWith(route) || request.method() !== 'GET') {
        issues.push(`${request.method()} ${request.url()}`)
      }
    })
    await provide(page)
    expect(issues, 'Erreurs JS/HTTP ou transferts hors ressources locales du prototype').toEqual([])
  },
})

async function capture(page: Page, name: string) {
  if (!evidence) return
  await mkdir(evidence, { recursive: true })
  await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: true, animations: 'disabled' })
}

async function ready(page: Page) {
  const scene = page.getByRole('region', { name: 'Zone de jeu' })
  await expect(scene).toHaveAttribute('data-game-state', 'ready')
  return scene
}

async function focusViaTab(page: Page, target: Locator) {
  for (let tab = 0; tab < 14; tab += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

async function position(scene: Locator): Promise<[number, number]> {
  const raw = await scene.getAttribute('data-position')
  const [x, y] = (raw ?? '').split(',').map(Number)
  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Position du jeu illisible : ${raw}`)
  }
  return [x, y]
}

async function move(
  page: Page,
  scene: Locator,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  reached: (point: [number, number]) => boolean,
) {
  await page.keyboard.down(key)
  try {
    await expect.poll(async () => reached(await position(scene)), { timeout: 7000, intervals: [40] }).toBe(true)
  } finally {
    await page.keyboard.up(key)
  }
}

async function finishWithMouse(page: Page, answer: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: answer }).check()
  await dialog.getByRole('button', { name: 'Vérifier mon choix' }).click()
  await dialog.getByRole('button', { name: 'Terminer l’étape' }).click()
  await expect(dialog).toHaveCount(0)
}

test('termine la mission en jeu au clavier et reprend position et progression', async ({ cleanPage: page }) => {
  await page.goto(route)
  const scene = await ready(page)
  const banner = page.getByText('Prévisualisation de développement · Campus fictif')
  await expect(banner).toHaveCount(process.env.WATTEAU_EXPECT_PREVIEW === '1' ? 1 : 0)
  await capture(page, '01-campus-desktop')
  await focusViaTab(page, scene)
  await expect(scene).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await move(page, scene, 'ArrowUp', ([, y]) => y < 301)
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Comprendre le besoin' })).toBeFocused()
  await capture(page, '02-dialogue-mission')

  for (let stage = 0; stage < answers.length; stage += 1) {
    await focusViaTab(page, dialog.getByRole('radio').first())
    await page.keyboard.press('Space')
    for (let option = 0; option < stage; option += 1) await page.keyboard.press('ArrowDown')
    await expect(dialog.getByRole('radio', { name: answers[stage]! })).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Vérifier mon choix' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog.getByRole('status')).not.toBeEmpty()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(scene).toBeFocused()

    if (stage === 0) {
      const savedPosition = await position(scene)
      await page.reload()
      await ready(page)
      expect(await position(scene)).toEqual(savedPosition)
      await expect(page.getByText('1 / 3 étapes')).toBeVisible()
      await focusViaTab(page, scene)
      await move(page, scene, 'ArrowUp', ([, y]) => y < 242)
      await move(page, scene, 'ArrowRight', ([x]) => x > 444)
      await page.keyboard.press('Enter')
      await expect(dialog.getByRole('heading', { name: 'Concevoir une interface' })).toBeFocused()
    }
    if (stage === 1) {
      await move(page, scene, 'ArrowRight', ([x]) => x > 779)
      await move(page, scene, 'ArrowDown', ([, y]) => y > 322)
      await page.keyboard.press('Enter')
      await expect(dialog.getByRole('heading', { name: 'Tester et améliorer' })).toBeFocused()
    }
  }

  await expect(page.getByText('3 / 3 étapes')).toBeVisible()
  await focusViaTab(page, page.getByRole('button', { name: 'Réfléchir dans mon carnet' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Mon carnet' })).toBeFocused()
  for (const note of await page.getByRole('textbox').all()) await expect(note).toHaveValue('')
})

test('propose les mêmes étapes sans jeu, puis enregistre, exporte et efface le carnet', async ({ cleanPage: page }) => {
  await page.goto(route)
  await page.getByRole('button', { name: 'Sans jeu' }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
  await capture(page, '03-parcours-sans-jeu')

  const open = page.getByRole('button', { name: 'Ouvrir', exact: true })
  const dialog = page.getByRole('dialog')
  await open.click()
  await dialog.getByRole('radio', { name: 'Choisir immédiatement les couleurs de l’application.' }).check()
  await dialog.getByRole('button', { name: 'Vérifier mon choix' }).click()
  await expect(dialog.getByRole('status')).toContainText('Les couleurs viendront ensuite')
  await page.keyboard.press('Escape')
  await expect(open).toBeFocused()
  await expect(page.getByText('0 / 3 étapes')).toBeVisible()

  for (const answer of answers) {
    await open.click()
    await finishWithMouse(page, answer)
  }
  await page.getByRole('button', { name: 'Réfléchir dans mon carnet' }).click()
  const note = page.getByRole('textbox', { name: 'Qu’est-ce qui m’a intéressé ?' })
  const syntheticNote = 'Essai synthétique : comprendre un besoin.'
  await note.fill(syntheticNote)
  await page.getByRole('button', { name: 'Enregistrer ma réflexion' }).click()
  await expect(page.getByText('Réflexion enregistrée dans le carnet.')).toBeVisible()
  await capture(page, '04-carnet')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sans jeu' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('3 / 3 étapes')).toBeVisible()
  await page.getByRole('button', { name: 'Carnet', exact: true }).click()
  await expect(note).toHaveValue(syntheticNote)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter le carnet' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('watteau-horizon-carnet.json')
  expect(JSON.parse(await readFile(await download.path(), 'utf8'))).toMatchObject({
    version: 1,
    completed: ['besoin', 'interface', 'test'],
    reflection: { interest: syntheticNote },
  })

  const erase = page.getByRole('button', { name: 'Effacer les données locales' })
  await erase.click()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(erase).toBeFocused()
  await expect(note).toHaveValue(syntheticNote)
  await erase.click()
  await dialog.getByRole('button', { name: 'Confirmer l’effacement' }).click()
  await expect(note).toHaveValue('')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull()
  await page.getByRole('button', { name: 'Voir les formations' }).click()
  await expect(page.getByRole('heading', { name: 'Deux formations à mettre côte à côte' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Consulter Parcoursup' })).toHaveAttribute('href', 'https://www.parcoursup.gouv.fr/')
})

test('conserve un carnet exportable en session lorsque le stockage est indisponible', async ({ cleanPage: page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Stockage bloqué par le navigateur.', 'SecurityError') },
    })
  })
  await page.goto(route)
  await expect(page.getByRole('alert')).toContainText('La sauvegarde locale est indisponible')
  await page.getByRole('button', { name: 'Carnet', exact: true }).click()
  const note = 'Note synthétique en mémoire.'
  await page.getByRole('textbox', { name: 'Qu’est-ce qui m’a intéressé ?' }).fill(note)
  await page.getByRole('button', { name: 'Enregistrer ma réflexion' }).click()
  await expect(page.getByText('Réflexion conservée pour cette session.')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('L’enregistrement local est indisponible')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter le carnet' }).click()
  const download = await downloadPromise
  expect(JSON.parse(await readFile(await download.path(), 'utf8')).reflection.interest).toBe(note)
})

test('bloque Antoine sur une jardinière et vérifie les poses avec et sans animation', async ({ cleanPage: page }) => {
  await page.goto(route)
  const scene = await ready(page)
  await scene.focus()
  await page.keyboard.down('ArrowRight')
  try {
    await expect.poll(async () => Number(await scene.getAttribute('data-sprite-frame')), { intervals: [30] }).toBeGreaterThan(8)
    await expect.poll(async () => (await position(scene))[0], { intervals: [40] }).toBeGreaterThan(324)
  } finally {
    await page.keyboard.up('ArrowRight')
  }
  await page.keyboard.down('ArrowUp')
  try {
    await expect.poll(async () => (await position(scene))[1]).toBeLessThan(411)
    await expect.poll(async () => Number(await scene.getAttribute('data-sprite-frame'))).toBe(12)
    expect((await position(scene))[1]).toBeGreaterThanOrEqual(405)
  } finally {
    await page.keyboard.up('ArrowUp')
  }

  const reduced = page.getByRole('button', { name: 'Réduire les animations' })
  await reduced.click()
  await expect(reduced).toHaveAttribute('aria-pressed', 'true')
  const visitedFrames: string[] = []
  await scene.focus()
  await page.keyboard.down('ArrowLeft')
  try {
    for (let sample = 0; sample < 12; sample += 1) {
      await page.evaluate(() => new Promise(requestAnimationFrame))
      visitedFrames.push(await scene.getAttribute('data-sprite-frame') ?? '')
    }
  } finally {
    await page.keyboard.up('ArrowLeft')
  }
  expect(visitedFrames.slice(3)).toEqual(Array(9).fill('4'))
  expect((await position(scene))[0]).toBeLessThan(324)
  await page.reload()
  await expect(reduced).toHaveAttribute('aria-pressed', 'true')
})

test('respecte les préférences système et passe axe sur les vues et le dialogue', async ({ cleanPage: page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(route)
  await ready(page)
  await expect(page.getByRole('button', { name: 'Réduire les animations' })).toHaveAttribute('aria-pressed', 'true')

  async function audit(label: string) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(result.violations, label).toEqual([])
    console.log(`axe — ${label} : 0 violation sur ${result.passes.length} règles applicables réussies.`)
  }

  await audit('Campus')
  await page.getByRole('button', { name: 'Sans jeu' }).click()
  await audit('Parcours sans jeu')
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click()
  await audit('Dialogue de mission')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Carnet', exact: true }).click()
  await audit('Carnet')
  await page.getByRole('button', { name: 'Formations', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deux formations à mettre côte à côte' })).toBeVisible()
  await audit('Formations')
})

test.describe('Mobile tactile', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })

  test('affiche le campus sur mobile et accepte les commandes tactiles', async ({ cleanPage: page, context }) => {
    await page.goto(route)
    const scene = await ready(page)
    const navigationToReadyMs = Math.round(await page.evaluate(() => performance.now()))
    await expect(scene).toHaveAttribute('data-camera-zoom', '1.64')
    await expect(page.getByText('Campus provisoire', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await capture(page, '05-campus-mobile')

    const up = page.getByRole('button', { name: 'Avancer vers le haut' })
    const box = await up.boundingBox()
    if (!box) throw new Error('Commande tactile hors écran.')
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
    try {
      await expect.poll(async () => (await position(scene))[1], { intervals: [40] }).toBeLessThan(301)
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await page.getByRole('button', { name: 'Ouvrir l’étape' }).tap()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Comprendre le besoin' })).toBeVisible()
    await expect(scene).toHaveAttribute('data-fps', /^\d+$/)
    const mobileSample = {
      viewport: page.viewportSize(),
      mode: 'Chromium headless, mobile tactile émulé, localhost',
      navigationToReadyMs,
      observedPhaserFps: Number(await scene.getAttribute('data-fps')),
    }
    expect(mobileSample.observedPhaserFps).toBeGreaterThan(0)
    console.log(JSON.stringify(mobileSample))
    if (evidence) await writeFile(join(evidence, 'performance-mobile.json'), JSON.stringify(mobileSample, null, 2) + '\n')
  })
})

test('cadre Antoine, bascule en vue fixe et ouvre seulement le repère proche', async ({ cleanPage: page }) => {
  await page.goto(route)
  const scene = await ready(page)
  await expect(scene).toHaveAttribute('data-camera-zoom', '1.2')
  const initial = await position(scene)
  const overview = page.getByRole('button', { name: 'Vue d’ensemble' })
  await overview.click()
  await expect(scene).toHaveAttribute('data-camera-zoom', '1')
  await expect(scene).toHaveAttribute('data-camera-center', '480.0,270.0')
  expect(await position(scene)).toEqual(initial)
  await capture(page, '06-campus-vue-ensemble')
  await overview.click()
  await expect(scene).toHaveAttribute('data-camera-zoom', '1.2')

  async function clickKiosk() {
    const box = await scene.boundingBox()
    const zoom = Number(await scene.getAttribute('data-camera-zoom'))
    const [x, y] = (await scene.getAttribute('data-camera-center') ?? '').split(',').map(Number)
    if (!box || x === undefined || y === undefined) throw new Error('Repère hors du cadre.')
    await page.mouse.click(box.x + box.width * (0.5 + (180 - x) * zoom / 960), box.y + box.height * (0.5 + (278 - y) * zoom / 540))
  }

  await clickKiosk()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(scene).toBeFocused()
  const center = await scene.getAttribute('data-camera-center')
  await move(page, scene, 'ArrowUp', ([, y]) => y < 290)
  await expect(scene).not.toHaveAttribute('data-camera-center', center!)
  await expect(page.getByRole('button', { name: 'Ouvrir l’étape' })).toBeEnabled()
  await clickKiosk()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Comprendre le besoin' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(scene).toBeFocused()

  await page.getByRole('button', { name: 'Réduire les animations' }).click()
  await expect(scene).toHaveAttribute('data-camera-zoom', '1')
  await expect(scene).toHaveAttribute('data-camera-center', '480.0,270.0')
})

test('compare deux fiches officielles, expose leur provenance et indique les données manquantes', async ({ cleanPage: page }) => {
  await page.goto(route)
  await page.getByRole('button', { name: 'Formations', exact: true }).click()
  await expect(page.getByText('Parcoursup · campagne 2026')).toBeVisible()
  await expect(page.getByText(/16 offres dans cet extrait/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cartographie Parcoursup' })).toHaveAttribute('href', /^https:\/\/data\.enseignementsup-recherche\.gouv\.fr\//)
  const first = page.getByLabel('Choisir la formation A')
  const second = page.getByLabel('Choisir la formation B')
  await expect(first.locator('option')).toHaveCount(17)
  await first.selectOption({ index: 1 })
  const selected = await first.inputValue()
  await expect(second.locator('option').nth(1)).toBeDisabled()
  await second.selectOption({ index: 2 })
  expect(await second.inputValue()).not.toBe(selected)
  await expect(page.getByText('2 sur 2 formations sélectionnées.')).toHaveCount(1)
  const cards = page.getByRole('region', { name: /^Formation [AB]$/ })
  for (const card of await cards.all()) {
    const duration = card.locator('.comparison-fields > div').filter({ hasText: 'Durée indicative' })
    await expect(duration.getByText('Durée indicative')).toBeVisible()
    await expect(duration.getByText('Non renseigné par la source')).toBeVisible()
    await expect(card.getByRole('link', { name: 'Voir la fiche Parcoursup' })).toHaveAttribute('href', /^https:\/\/dossierappel\.parcoursup\.fr\//)
  }
  await capture(page, '07-comparateur-desktop')
  await cards.first().getByText('Provenance par champ').click()
  await expect(cards.first().getByText(/collecte du 26 novembre 2026/).first()).toBeVisible()
  await expect(cards.first().getByText(/Durée absente du schéma/)).toBeVisible()
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
  await cards.first().getByText('Provenance par champ').click()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await capture(page, '08-comparateur-mobile')
})

test('mesure le coût des modes sans jeu et jeu sur le build statique', async ({ cleanPage: page, browser }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, mode: 'accessible' })), storageKey)
  await page.goto(route)
  await expect(page.getByRole('button', { name: 'Sans jeu' })).toHaveAttribute('aria-pressed', 'true')
  const resourcesBefore = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(resourcesBefore.some((url) => url.includes('createCampus-'))).toBe(false)

  const start = await page.evaluate(() => performance.now())
  await page.getByRole('button', { name: 'Mode jeu' }).click()
  const scene = await ready(page)
  const timeToReadyMs = Math.round(await page.evaluate(() => performance.now()) - start)
  await expect(scene).toHaveAttribute('data-fps', /^\d+$/, { timeout: 10000 })
  const fps = Number(await scene.getAttribute('data-fps'))
  await scene.focus()
  await page.keyboard.down('ArrowUp')
  let animation: { frames: number; medianMs: number; p95Ms: number; maxMs: number; framesOver32Ms: number }
  try {
    animation = await page.evaluate(async () => {
      const samples: number[] = []
      let previous = await new Promise<number>(requestAnimationFrame)
      for (let index = 0; index < 90; index += 1) {
        const now = await new Promise<number>(requestAnimationFrame)
        samples.push(now - previous)
        previous = now
      }
      const sorted = samples.sort((left, right) => left - right)
      return {
        frames: samples.length,
        medianMs: Math.round(sorted[44]! * 10) / 10,
        p95Ms: Math.round(sorted[85]! * 10) / 10,
        maxMs: Math.round(sorted.at(-1)! * 10) / 10,
        framesOver32Ms: samples.filter((value) => value > 32).length,
      }
    })
  } finally {
    await page.keyboard.up('ArrowUp')
  }
  const sample = {
    browser: browser.version(),
    platform: process.platform,
    viewport: page.viewportSize(),
    mode: 'Chromium headless, localhost, cache froid au démarrage',
    timeToReadyMs,
    observedPhaserFps: fps,
    animation,
    resourcesAfter: await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming
      return { path: new URL(resource.name).pathname, decodedBytes: resource.decodedBodySize }
    })),
  }
  expect(fps).toBeGreaterThan(0)
  console.log(JSON.stringify(sample))
  if (evidence) {
    await mkdir(evidence, { recursive: true })
    await writeFile(join(evidence, 'performance.json'), JSON.stringify(sample, null, 2) + '\n')
  }
})
