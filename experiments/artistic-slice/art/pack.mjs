import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const [source, destination] = process.argv.slice(2)
if (!source || !destination || resolve(source) === resolve(destination)) throw new Error('Indiquer deux dossiers distincts : exports Blender, puis actifs web.')
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
})
await mkdir(destination, { recursive: true })
for (const name of ['campus.glb', 'avatar.glb', 'antoine.glb']) {
  const input = await readFile(resolve(source, name))
  const document = await io.readBinary(input)
  // High precision for close framing. Keep geometry topology, material images and clip content.
  await document.transform(meshopt({
    encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12,
    quantizeTexcoord: 16, quantizeColor: 12, quantizeWeight: 12, quantizeGeneric: 16,
  }))
  const output = await io.writeBinary(document)
  await writeFile(resolve(destination, name), output)
  console.log(name, input.length, '→', output.length, 'octets · gzip', gzipSync(output).length)
}
await copyFile(resolve(source, 'antoine.webp'), resolve(destination, 'antoine.webp'))
