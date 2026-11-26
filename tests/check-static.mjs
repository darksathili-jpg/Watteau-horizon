import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = new URL('../dist/', import.meta.url)
const html = await readFile(new URL('index.html', dist), 'utf8')
const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
assert.match(html, /lang="fr"/)
assert.match(html, /default-src 'self'/)
assert.match(html, /form-action 'none'/)
assert.match(html, /name="robots" content="noindex, nofollow"/)
assert.match(html, /name="referrer" content="no-referrer"/)
assert.ok(!html.includes('%BASE_URL%'))

for (const resource of resources) {
  assert.ok(resource.startsWith('./'), `Chemin relatif attendu : ${resource}`)
  assert.ok((await stat(new URL(resource, dist))).isFile())
}

for (const asset of ['campus.webp', 'antoine-atlas.png', 'antoine-portrait.png']) {
  assert.ok((await stat(new URL(`art/${asset}`, dist))).size > 0)
}

assert.match(await readFile(new URL('THIRD-PARTY-NOTICES.md', dist), 'utf8'), /phaser.*MIT/)
assert.match(await readFile(new URL('EMBEDDED-NOTICES.txt', dist), 'utf8'), /EventEmitter3/)
assert.ok((await stat(new URL('.nojekyll', dist))).isFile())

for (const file of (await readdir(new URL('assets/', dist))).sort()) {
  const data = await readFile(new URL(join('assets', file), dist))
  assert.doesNotMatch(data.toString('utf8'), /Formation synthétique|fixture interne|API_KEY|BEGIN PRIVATE KEY/)
  console.log(`${file}: ${data.byteLength} octets, gzip ${gzipSync(data).byteLength}`)
}
console.log(`Contrôle statique OK : ${resources.length} références relatives, 3 images locales, CSP et aucun jeu d’essai embarqué.`)
