import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from '@playwright/test'
import { git, sha256 } from './checks.mjs'

const prefix = '/Watteau-horizon/'
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
const scenes = [
  { id: 'campus-desktop', viewport: 'desktop', view: 'campus' },
  { id: 'campus-mobile', viewport: 'mobile', view: 'campus' },
  { id: 'parcours-sans-jeu', viewport: 'desktop', view: 'accessible' },
  { id: 'comparateur-desktop', viewport: 'desktop', view: 'catalogue' },
  { id: 'comparateur-mobile', viewport: 'mobile', view: 'catalogue' },
]

async function serve(root) {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    const file = resolve(root, pathname.slice(prefix.length) || 'index.html')
    const mime = contentTypes[extname(file)]
    if (request.method !== 'GET' || !pathname.startsWith(prefix) || relative(root, file).startsWith('..') || !mime) {
      response.writeHead(404).end()
      return
    }
    try {
      const body = await readFile(file)
      response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((listening, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', listening)
  })
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    close: () => new Promise((done) => server.close(done)),
  }
}

async function capture(browser, url, scene, viewport, path) {
  const mobile = scene.viewport === 'mobile'
  const context = await browser.newContext({
    viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1,
    locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'dark', reducedMotion: 'no-preference',
  })
  try {
    const page = await context.newPage()
    const problems = []
    page.on('pageerror', (error) => problems.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()) })
    const response = await page.goto(url)
    if (!response?.ok()) throw new Error(`Page indisponible : ${scene.id}.`)
    await page.locator('[data-game-state="ready"]').waitFor()
    if (scene.view === 'accessible') await page.getByRole('button', { name: 'Sans jeu' }).click()
    if (scene.view === 'catalogue') {
      await page.getByRole('button', { name: 'Formations', exact: true }).click()
      await page.getByLabel('Choisir la formation A').selectOption({ index: 1 })
      await page.getByLabel('Choisir la formation B').selectOption({ index: 2 })
      await page.getByText('2 sur 2 formations sélectionnées.').waitFor({ state: 'attached' })
    }
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    })
    const screenshot = await page.screenshot({ path, fullPage: true, animations: 'disabled', scale: 'css' })
    if (problems.length) throw new Error(`${scene.id} : ${problems.join(' | ')}`)
    return screenshot
  } finally {
    await context.close()
  }
}

async function compare(page, reference, candidate) {
  return page.evaluate(async ([before, after]) => {
    async function imagePixels(base64) {
      const image = new Image()
      image.src = 'data:image/png;base64,' + base64
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0)
      return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) }
    }
    const a = await imagePixels(before)
    const b = await imagePixels(after)
    const dimensions = { reference: [a.canvas.width, a.canvas.height], candidate: [b.canvas.width, b.canvas.height] }
    if (a.canvas.width !== b.canvas.width || a.canvas.height !== b.canvas.height) {
      return { dimensions, changed: null, pixels: null, diff: null }
    }
    const output = a.ctx.createImageData(a.canvas.width, a.canvas.height)
    let changed = 0
    for (let i = 0; i < a.data.data.length; i += 4) {
      const different = a.data.data[i] !== b.data.data[i]
        || a.data.data[i + 1] !== b.data.data[i + 1]
        || a.data.data[i + 2] !== b.data.data[i + 2]
        || a.data.data[i + 3] !== b.data.data[i + 3]
      if (different) changed += 1
      const gray = Math.round((a.data.data[i] + a.data.data[i + 1] + a.data.data[i + 2]) / 4)
      output.data[i] = different ? 255 : gray
      output.data[i + 1] = different ? 38 : gray
      output.data[i + 2] = different ? 89 : gray
      output.data[i + 3] = 255
    }
    a.ctx.putImageData(output, 0, 0)
    return { dimensions, changed, pixels: a.canvas.width * a.canvas.height, diff: a.canvas.toDataURL('image/png').split(',')[1] }
  }, [reference.toString('base64'), candidate.toString('base64')])
}

export async function visualComparison({ root, out, baseline, policy, command, env }) {
  const evidence = resolve(out, 'visual')
  await mkdir(evidence, { recursive: true })
  const temp = await mkdtemp(join(tmpdir(), 'watteau-visual-'))
  const checkout = resolve(temp, 'reference')
  let browser
  const servers = []
  try {
    await mkdir(checkout)
    const tar = resolve(temp, 'reference.tar')
    await git(root, 'archive', `--output=${tar}`, baseline.revision)
    const extract = await command('visual-extract', 'tar', ['-xf', tar, '-C', checkout])
    if (extract.status !== 'PASS') return extract
    const readLockfile = async (directory) => sha256(await readFile(resolve(directory, 'package-lock.json')))
    if (await readLockfile(root) === await readLockfile(checkout)) {
      await symlink(resolve(root, 'node_modules'), resolve(checkout, 'node_modules'), 'junction')
    } else {
      const install = await command('visual-install', 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: checkout })
      if (install.status !== 'PASS') return install
    }
    const build = await command('visual-build-reference', 'npm', ['run', 'build'], { cwd: checkout, env })
    if (build.status !== 'PASS') return build
    servers.push(await serve(resolve(checkout, 'dist')))
    servers.push(await serve(resolve(root, 'dist')))
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined })
    const comparisonPage = await browser.newPage()
    const observations = []
    for (const scene of scenes) {
      try {
        const viewport = policy.viewports[scene.viewport]
        const reference = await capture(browser, servers[0].url, scene, viewport, resolve(evidence, `${scene.id}-reference.png`))
        const candidate = await capture(browser, servers[1].url, scene, viewport, resolve(evidence, `${scene.id}-candidate.png`))
        const { diff, ...metrics } = await compare(comparisonPage, reference, candidate)
        if (diff) await writeFile(resolve(evidence, `${scene.id}-diff.png`), Buffer.from(diff, 'base64'))
        observations.push({ id: scene.id, viewport, ...metrics })
      } catch (error) {
        observations.push({ id: scene.id, error: error.message })
      }
    }
    const result = {
      reference: baseline.revision,
      browser: browser.version(),
      maximumChangedPixels: policy.maximumChangedPixels,
      scenarios: observations,
    }
    await writeFile(resolve(evidence, 'comparison.json'), JSON.stringify(result, null, 2) + '\n')
    const different = observations.filter((item) => item.error || item.changed === null || item.changed > policy.maximumChangedPixels)
    return {
      status: different.length ? 'FAIL' : 'PASS',
      summary: different.length ? `Comparaisons en écart : ${different.map(({ id }) => id).join(', ')}.`
        : `${observations.length} scénarios, 0 pixel différent.`,
      artifact: 'visual/comparison.json',
    }
  } finally {
    try {
      await browser?.close()
    } finally {
      await Promise.all(servers.map((server) => server.close()))
      await rm(temp, { recursive: true, force: true })
    }
  }
}
