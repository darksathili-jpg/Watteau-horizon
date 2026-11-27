import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { serveSlice } from './serve.mjs'

const [original, packed, target] = process.argv.slice(2)
if (!original || !packed || !target) throw new Error('Usage : compare-pack.mjs <dist GLB source> <dist conditionné> <preuves>')
await mkdir(target, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const stats = {}
try {
  for (const [name, directory] of [['raw', original], ['packed', packed]]) {
    const server = await serveSlice(directory)
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()) })
      await page.goto(server.url + '?instrument=1', { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.watteauP4?.observe().textures >= 40)
      stats[name] = await page.evaluate(() => window.watteauP4.observe())
      await page.locator('canvas').screenshot({ path: resolve(target, name + '.png') })
      assert.deepEqual(errors, [])
    } finally {
      await context.close()
      await server.close()
    }
  }
} finally {
  await browser.close()
}
assert.equal(stats.raw.triangles, stats.packed.triangles)
assert.equal(stats.raw.textures, stats.packed.textures)
await writeFile(resolve(target, 'comparison.json'), JSON.stringify(stats, null, 2) + '\n')
