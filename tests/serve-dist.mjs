import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const prefix = '/Watteau-horizon/'
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (!['GET', 'HEAD'].includes(request.method) || !url.pathname.startsWith(prefix)) {
    response.writeHead(404).end()
    return
  }

  const path = resolve(root, url.pathname.slice(prefix.length) || 'index.html')
  const mime = types[extname(path)]
  if (!path.startsWith(root + sep) || !mime) {
    response.writeHead(404).end()
    return
  }

  try {
    const content = await readFile(path)
    response.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length, 'X-Content-Type-Options': 'nosniff' })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch {
    response.writeHead(404).end()
  }
}).listen(4173, '127.0.0.1')
