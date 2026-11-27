import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { arch, cpus, platform, release } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'
import { serveSlice } from './serve.mjs'

const path = process.argv[2]
if (!path) throw new Error('Indiquer un dossier de mesures.')
const out = resolve(path)
await mkdir(out, { recursive: true })
const protocol = JSON.parse(await readFile('production/engine-protocol.json', 'utf8'))
const budgets = protocol.proposedBudgets
const server = await serveSlice('experiments/artistic-slice/dist')
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const profiles = {
  desktop: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
}
const url = server.url + '?instrument=1'
const percentile = (samples, position) => samples.toSorted((a, b) => a - b)[Math.max(0, Math.ceil(samples.length * position) - 1)]
const receipt = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
  environment: {
    chromium: browser.version(), node: process.version, platform: platform(), release: release(), architecture: arch(),
    cpu: cpus()[0]?.model, cpuQuota: await readFile('/sys/fs/cgroup/cpu.max', 'utf8').then((v) => v.trim()).catch(() => null),
    ramLimit: await readFile('/sys/fs/cgroup/memory.max', 'utf8').then((v) => v.trim()).catch(() => null),
  },
  settings: { profiles, budgets, repetitions: protocol.minimumColdRunsPerCombination, motionSeconds: protocol.movementSampleSeconds },
  files: server.sizes,
  profiles: {},
}
const route = [
  ['ArrowUp', 3600], ['ArrowLeft', 2450], ['ArrowDown', 3150], ['ArrowRight', 5100],
  ['ArrowUp', 3200], ['ArrowLeft', 2850], ['ArrowDown', 3450],
]

async function useContext(profile, perform, video) {
  const context = await browser.newContext({
    ...profile,
    ...(video ? { recordVideo: { dir: out, size: profile.isMobile ? { width: 390, height: 844 } : { width: 1080, height: 720 } } } : {}),
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const finished = new Map()
  const failures = new Map()
  const requested = new Map()
  const errors = []
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
    if (request.url.startsWith('http:') || request.url.startsWith('https:')) requested.set(requestId, request.url)
  })
  cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => finished.set(requestId, encodedDataLength))
  cdp.on('Network.loadingFailed', ({ requestId, errorText }) => failures.set(requestId, errorText))
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()) })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForFunction(() => window.watteauP4 && document.querySelector('.world-canvas canvas'), { timeout: 35_000 })
    const ready = await page.evaluate(() => ({ elapsedMs: window.watteauP4.readyAt, state: window.watteauP4.observe() }))
    await page.waitForLoadState('networkidle')
    const transfers = Array.from(requested, ([id, url]) => ({
      file: new URL(url).pathname, bytes: finished.get(id) ?? null, error: failures.get(id) ?? null,
    }))
    const result = { ready, transfers, transferBytes: transfers.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0), errors }
    await perform(page, result)
    assert(transfers.every(({ bytes, error }) => bytes !== null && error === null), JSON.stringify(transfers))
    assert.deepEqual(errors, [])
    return result
  } finally {
    await context.close()
    if (video) {
      const recording = page.video()
      await recording.saveAs(resolve(out, video + '.webm'))
      await recording.delete()
    }
  }
}

try {
  const onlyVideo = process.argv.includes('--video')
  for (const [name, profile] of Object.entries(profiles)) {
    if (onlyVideo) {
      await useContext(profile, async (page) => {
        await page.getByLabel('Scène jouable. Flèches pour se déplacer').focus()
        await delay(1300)
        await page.keyboard.down('ArrowUp')
        try { await page.getByRole('button', { name: 'Interagir', exact: true }).waitFor(); await page.waitForFunction(() => !document.querySelector('.engage')?.disabled) }
        finally { await page.keyboard.up('ArrowUp') }
        await delay(450)
        await page.keyboard.press('Enter')
        await page.getByRole('dialog').waitFor()
        await delay(1500)
        await page.getByRole('radio').first().check()
        await page.getByRole('button', { name: 'Vérifier mon choix' }).click()
        await delay(1300)
        await page.getByRole('button', { name: 'Terminer l’étape' }).click()
        await page.keyboard.down('ArrowLeft')
        await delay(1700)
        await page.keyboard.up('ArrowLeft')
        await delay(800)
      }, `parcours-${name}`)
      console.log(`vidéo ${name} enregistrée`)
      continue
    }
    const results = receipt.profiles[name] = { cold: [], failures: [] }
    for (let index = 0; index < protocol.minimumColdRunsPerCombination; index++) {
      try {
        const cold = await useContext(profile, async () => {})
        results.cold.push(cold)
        console.log(name, 'à froid', index + 1, Math.round(cold.ready.elapsedMs), 'ms', cold.transferBytes, 'octets')
      } catch (error) {
        results.failures.push({ phase: 'cold', repetition: index + 1, error: error.stack })
      }
    }
    try {
      results.motion = await useContext(profile, async (page, result) => {
        const position = () => page.evaluate(() => window.watteauP4.observe())
        await page.getByLabel('Scène jouable. Flèches pour se déplacer').focus()
        const started = performance.now()
        await page.evaluate(() => window.watteauP4.sample(true))
        const segments = []
        const duration = protocol.movementSampleSeconds * 1000
        for (let index = 0; performance.now() - started < duration; index++) {
          const [key, segment] = route[index % route.length]
          const from = await position()
          await page.keyboard.down(key)
          try { await delay(Math.min(segment, Math.max(0, duration - (performance.now() - started)))) }
          finally { await page.keyboard.up(key) }
          segments.push({ key, from, to: await position() })
        }
        const intervals = await page.evaluate(() => window.watteauP4.sample(false))
        assert(intervals.length > 0)
        result.motion = {
          intervals, seconds: intervals.reduce((sum, value) => sum + value, 0) / 1000,
          p95Ms: percentile(intervals, .95), medianMs: percentile(intervals, .5), requestedSeconds: protocol.movementSampleSeconds,
          segments,
        }
      })
    } catch (error) {
      results.failures.push({ phase: 'motion', error: error.stack })
    }
    const coldAvailable = results.cold.length === protocol.minimumColdRunsPerCombination
    const start = coldAvailable ? percentile(results.cold.map(({ ready }) => ready.elapsedMs), .5) : null
    const transfer = coldAvailable ? Math.max(...results.cold.map(({ transferBytes }) => transferBytes)) : null
    const cadence = results.motion?.motion.p95Ms ?? null
    const measured = (value, limit) => ({ value, limit, status: value === null ? 'BLOCKED' : value <= limit ? 'PASS' : 'FAIL' })
    results.criteria = {
      availability: measured(start, budgets[`${name}ReadyMedianMs`]),
      transfer: measured(transfer, budgets.initialTransferBytes),
      cadence: measured(cadence, budgets[`${name}FrameP95Ms`]),
    }
    console.log(name, JSON.stringify(results.criteria))
  }
} finally {
  receipt.finishedAt = new Date().toISOString()
  await browser.close()
  await server.close()
  if (!process.argv.includes('--video')) await writeFile(resolve(out, 'benchmark.json'), JSON.stringify(receipt, null, 2) + '\n')
}
if (Object.values(receipt.profiles).some(({ criteria, failures }) => failures.length || Object.values(criteria).some(({ status }) => status !== 'PASS'))) process.exitCode = 1
