import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8',
}
export const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' blob:; img-src 'self' blob:; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const prefix = '/watteau-p4/'

export async function serveSlice(directory, port = 0) {
  const root = resolve(directory)
  const files = new Map()
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    const type = mime[extname(entry.name)]
    if (!entry.isFile() || !type) continue
    const full = join(entry.parentPath, entry.name)
    const raw = await readFile(full)
    files.set(prefix + relative(root, full), { raw, gzip: raw.length >= 512 ? gzipSync(raw) : null, type })
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = files.get(path.endsWith('/') ? path + 'index.html' : path)
    if (!file || !['GET', 'HEAD'].includes(request.method)) return response.writeHead(404).end()
    const compressed = file.gzip && request.headers['accept-encoding']?.split(',').some((value) => value.trim() === 'gzip')
    const body = compressed ? file.gzip : file.raw
    response.writeHead(200, {
      'Content-Type': file.type, 'Content-Length': body.length, 'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding',
      'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
      ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
    }).end(request.method === 'HEAD' ? undefined : body)
  })
  await new Promise((done, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', done)
  })
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    sizes: Object.fromEntries([...files].map(([url, file]) => [url, { raw: file.raw.length, gzip: file.gzip?.length ?? null, sha256: createHash('sha256').update(file.raw).digest('hex') }])),
    close: () => new Promise((done) => server.close(done)),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const served = await serveSlice(process.argv[2] ?? 'experiments/artistic-slice/dist', Number(process.argv[3] ?? 4175))
  console.log(served.url)
}
