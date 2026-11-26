import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
}
const prefix = '/engine-trials/'

export async function serveTrials(directory, port = 0) {
  const root = resolve(directory)
  const files = new Map()
  async function collect(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const full = resolve(folder, entry.name)
      if (entry.isDirectory()) await collect(full)
      else if (entry.isFile() && mime[extname(full)]) {
        const raw = await readFile(full)
        const gzip = raw.length >= 512 ? gzipSync(raw) : null
        files.set(prefix + full.slice(root.length + sep.length).split(sep).join('/'), { raw, gzip, mime: mime[extname(full)] })
      }
    }
  }
  await collect(root)
  const server = createServer((request, response) => {
    const target = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = files.get(target.endsWith('/') ? target + 'index.html' : target)
    if (!file || !['GET', 'HEAD'].includes(request.method)) return response.writeHead(404).end()
    const compressed = file.gzip && request.headers['accept-encoding']?.split(',').some((value) => value.trim() === 'gzip')
    const body = compressed ? file.gzip : file.raw
    response.writeHead(200, {
      'Content-Type': file.mime, 'Content-Length': body.length, 'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
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
  const folder = process.argv[2] ?? 'experiments/engine-trials/dist'
  const port = Number(process.argv[3] ?? '4174')
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port invalide.')
  const served = await serveTrials(folder, port)
  console.log(served.url)
}
