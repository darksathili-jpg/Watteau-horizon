import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import validator from 'gltf-validator'

const actions = ['Dialogue', 'Idle', 'Interact', 'Run', 'Turn', 'Walk']
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const files = [
  { name: 'campus.glb', source: 'campus.py', kind: 'Décor original fictif', rights: 'Création P4. Revue de diffusion en attente. Voir CAMPUS.md.' },
  { name: 'avatar.glb', source: 'characters.py', kind: 'Avatar contrôlé · création P4', rights: 'Entrées anatomiques MPFB sous CC0 1.0. Créations P4. Voir CHARACTER-SOURCES.md.' },
  { name: 'antoine.glb', source: 'characters.py', kind: 'Antoine · création P4', rights: 'Entrées anatomiques MPFB sous CC0 1.0. Créations P4. Voir CHARACTER-SOURCES.md.' },
]
const manifest = { schema: 1, context: 'P4 · démonstration de développement, revue de diffusion en attente', assets: [] }
const validations = {}
for (const file of files) {
  const bytes = await readFile(new URL(`../public/assets/${file.name}`, import.meta.url))
  const source = await readFile(new URL(file.source, import.meta.url))
  const report = await validator.validateBytes(bytes, { uri: file.name, maxIssues: 1000 })
  validations[file.name] = report
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
  const primitives = doc.meshes.flatMap(({ primitives }) => primitives)
  const animations = (doc.animations ?? []).map(({ name, channels, samplers }) => ({
    name, channels: channels.length,
    durationSeconds: Number(Math.max(...samplers.map(({ input }) => doc.accessors[input].max[0])).toFixed(3)),
  }))
  const textures = (doc.images ?? []).map((image, index) => {
    const details = report.info.resources.find(({ pointer }) => pointer === `/images/${index}`)?.image
    return { name: image.name, mime: image.mimeType, width: details?.width, height: details?.height, bytes: doc.bufferViews[image.bufferView]?.byteLength }
  })
  manifest.assets.push({
    ...file, sourceSha256: sha256(source), sha256: sha256(bytes), bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
    meshes: doc.meshes.length, primitives: primitives.length, materials: doc.materials.length,
    triangles: primitives.reduce((sum, p) => sum + doc.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0),
    vertices: primitives.reduce((sum, p) => sum + doc.accessors[p.attributes.POSITION].count, 0),
    skins: (doc.skins ?? []).map(({ joints }) => joints.map((node) => doc.nodes[node].name)),
    animations, textures, lod: 'Aucun niveau alternatif dans cet export',
    pbr: doc.materials.every((material) => material.pbrMetallicRoughness || material.normalTexture || material.emissiveFactor),
    extensions: doc.extensionsRequired ?? [],
    uvPrimitives: primitives.filter(({ attributes }) => attributes.TEXCOORD_0 !== undefined).length,
    validator: { version: report.validatorVersion, errors: report.issues.numErrors, warnings: report.issues.numWarnings },
  })
  assert.equal(doc.asset.version, '2.0', file.name)
  assert(primitives.every(({ attributes }) => attributes.TEXCOORD_0 !== undefined), file.name)
  assert((doc.images ?? []).every((image) => Number.isInteger(image.bufferView)) && doc.buffers.every((buffer) => !buffer.uri), file.name)
  if (file.name !== 'campus.glb') {
    assert(doc.skins?.some((skin) => skin.joints.length >= 15), file.name)
    assert.deepEqual(animations.map(({ name }) => name).sort(), actions, file.name)
    assert(animations.every(({ channels, durationSeconds }) => channels > 0 && durationSeconds > 0), file.name)
    assert(primitives.some(({ attributes }) => attributes.JOINTS_0 !== undefined && attributes.WEIGHTS_0 !== undefined), file.name)
  }
}
const portrait = await readFile(new URL('../public/assets/antoine.webp', import.meta.url))
manifest.assets.push({ name: 'antoine.webp', kind: 'Portrait d’Antoine issu de son modèle 3D', rights: 'Rendu Blender de la création P4. Voir CHARACTER-SOURCES.md.', sha256: sha256(portrait), bytes: portrait.length })
const json = JSON.stringify(manifest, null, 2) + '\n'
const inventoryUrl = new URL('./manifest.json', import.meta.url)
if (process.argv.includes('--write')) await writeFile(inventoryUrl, json)
else assert.equal(json, await readFile(inventoryUrl, 'utf8'), 'Inventaire périmé, examiner les actifs puis régénérer.')
const output = process.argv.find((value) => value.startsWith('--validator-out='))?.split('=').slice(1).join('=')
if (output) await writeFile(output, JSON.stringify(validations, null, 2) + '\n')
for (const [name, report] of Object.entries(validations)) {
  console.log(`${name} · ${report.issues.numErrors} erreur(s) · ${report.issues.numWarnings} avertissement(s)`)
  assert.equal(report.issues.numErrors, 0, name)
}
