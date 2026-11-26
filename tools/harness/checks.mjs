import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

export const gates = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))

export function processResult(program, args, { cwd, env = process.env, timeout = 240000 } = {}) {
  return new Promise((done) => {
    const child = spawn(program, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    let error
    let timedOut = false
    child.stdout?.on('data', (chunk) => stdout.push(chunk))
    child.stderr?.on('data', (chunk) => stderr.push(chunk))
    child.once('error', (problem) => { error = problem })
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, timeout)
    child.once('close', (code) => {
      clearTimeout(timer)
      done({ code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), error, timedOut })
    })
  })
}

export async function git(root, ...args) {
  const result = await processResult('git', args, { cwd: root })
  if (result.error || result.code !== 0) throw new Error(`git ${args[0]} a échoué : ${result.stderr.toString().trim() || result.error?.message || result.code}`)
  return result.stdout
}

export function combine(results) {
  if (results.some(({ status }) => status === 'FAIL')) return 'FAIL'
  if (!results.length || results.some(({ status }) => status !== 'PASS')) return 'BLOCKED'
  return 'PASS'
}

export function decide(gateResults, profile, review, scoped = false) {
  const automated = gateResults.filter(({ id }) => id !== 'Q8')
  const complete = automated.map(({ id }) => id).sort().join() === gates.slice(0, -1).join()
  const critical = complete ? combine(automated) : 'BLOCKED'
  const release = critical === 'PASS' && review === 'PASS' && gateResults.some(({ id, status }) => id === 'Q8' && status === 'PASS')
    ? 'PASS' : 'BLOCKED'
  const exitCode = scoped ? (combine(gateResults) === 'PASS' ? 0 : 1)
    : profile === 'students' ? (release === 'PASS' ? 0 : 1)
      : (critical === 'PASS' ? 0 : 1)
  return { automated: critical, studentRelease: release, exitCode }
}

export async function verifyReference(root, baseline, section) {
  if (!/^[a-f0-9]{40}$/.test(baseline.revision)) throw new Error('Révision de référence invalide.')
  await git(root, 'merge-base', '--is-ancestor', baseline.revision, 'HEAD')
  const tree = (await git(root, 'ls-tree', '-rz', '--name-only', baseline.revision)).toString().split('\0')
  const expectedPaths = section === 'art'
    ? tree.filter((path) => path.startsWith('public/art/'))
    : tree.filter((path) => path.startsWith('tests/') || (path.startsWith('src/') && path.endsWith('.test.ts')) || path === 'playwright.config.ts')
  const paths = Object.keys(baseline[section])
  if (!expectedPaths.length || paths.sort().join('\0') !== expectedPaths.sort().join('\0')) {
    throw new Error(`Inventaire de référence incomplet : ${section}.`)
  }
  for (const path of paths) {
    const reference = await git(root, 'show', `${baseline.revision}:${path}`)
    if (sha256(reference) !== baseline[section][path]) throw new Error(`Empreinte de référence incohérente : ${path}.`)
    const candidate = await readFile(resolve(root, path))
    if (sha256(candidate) !== baseline[section][path]) throw new Error(`Fichier surveillé modifié : ${path}.`)
  }
  return { revision: baseline.revision, files: paths }
}

export async function subject(root) {
  const listing = (await git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')).toString().split('\0')
  const paths = [...new Set(listing.filter(Boolean))].sort()
  const buildFiles = paths.filter((file) => /^(src\/|public\/|data\/|tools\/|tests\/|production\/|\.github\/|\.agents\/|index\.html$|package(-lock)?\.json$|[a-z]+\.config\.ts$|tsconfig\.json$)/.test(file))
  const entries = []
  for (const path of buildFiles) {
    const file = resolve(root, path)
    if (!(await lstat(file)).isFile()) throw new Error(`Fichier de production non ordinaire : ${path}.`)
    entries.push([path, sha256(await readFile(file))])
  }
  const commit = (await git(root, 'rev-parse', 'HEAD')).toString().trim()
  const dirty = (await git(root, 'status', '--porcelain', '--untracked-files=normal')).length > 0
  return { commit, dirty, subjectSha256: sha256(JSON.stringify(entries)) }
}

export async function checkAttestation(file, state, categories) {
  if (!file) return { status: 'BLOCKED', summary: `Attestation de mise à disposition absente : ${categories.join(', ')}.` }
  const root = await realpath(resolve(file, '..'))
  const value = await readJson(file)
  if (!state || state.dirty || value.schema !== 1 || value.commit !== state.commit || value.subjectSha256 !== state.subjectSha256) {
    return { status: 'BLOCKED', summary: 'L’attestation doit viser le commit et les empreintes du checkout propre.' }
  }
  const missing = []
  for (const key of categories) {
    const review = value.reviews?.[key]
    if (review?.status !== 'verified' || typeof review.approver !== 'string' || !review.approver.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(review.date) || !Number.isFinite(Date.parse(review.date))
      || new Date(review.date).toISOString().slice(0, 10) !== review.date
      || Date.parse(review.date) >= Date.now() + 86400000
      || typeof review.file !== 'string' || isAbsolute(review.file) || !/^[a-f0-9]{64}$/.test(review.sha256)) {
      missing.push(key)
      continue
    }
    const evidence = await realpath(resolve(root, review.file)).catch(() => null)
    if (!evidence || !relative(root, evidence) || relative(root, evidence).split(/[\\/]/)[0] === '..'
      || !((await lstat(evidence)).isFile()) || sha256(await readFile(evidence)) !== review.sha256) missing.push(key)
  }
  return missing.length
    ? { status: 'BLOCKED', summary: `Revues manquantes ou preuves invalides : ${missing.join(', ')}.` }
    : { status: 'PASS', summary: 'Attestation complète, pièces vérifiées et liées à cette révision.' }
}

export function browserTests(report) {
  const tests = new Map()
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      const valid = spec.tests.length > 0 && spec.tests.every((test) =>
        test.status === 'expected' && test.expectedStatus === 'passed' && test.results.some(({ status }) => status === 'passed'))
      tests.set(spec.title, (tests.get(spec.title) ?? true) && valid)
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  visit(report)
  return tests
}

export function verifyPrivacyPolicy(html) {
  const content = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1]
  if (!content) throw new Error('Politique CSP absente.')
  const directives = content.split(';').map((entry) => entry.trim().split(/\s+/)).filter(([entry]) => entry)
  const policy = Object.fromEntries(directives.map(([key, ...values]) => [key, values.join(' ')]))
  const expected = {
    'default-src': "'self'",
    'script-src': "'self'",
    'connect-src': "'self'",
    'img-src': "'self' data: blob:",
    'style-src': "'self' 'unsafe-inline'",
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': "'none'",
  }
  if (directives.length !== Object.keys(expected).length || directives.length !== Object.keys(policy).length || Object.entries(expected).some(([key, value]) => policy[key] !== value)) {
    throw new Error('La politique CSP autorise une capacité hors périmètre.')
  }
  if (!html.includes('name="referrer" content="no-referrer"')) throw new Error('Politique de référent absente.')
}

const secretMarkers = [
    /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/,
    /\bgh[pousr]_[0-9A-Za-z]{30,}\b/,
    /\bgithub_pat_[0-9A-Za-z_]{30,}\b/,
    /\bAKIA[A-Z0-9]{16}\b/,
  ]

export async function scanRepository(root) {
  const files = (await git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')).toString().split('\0').filter(Boolean)
  const sensitiveNames = /(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|[^/]+\.pem|[^/]+\.p12)$/i
  const findings = []
  for (const file of new Set(files)) {
    const path = resolve(root, file)
    if (!(await lstat(path)).isFile()) {
      findings.push(file)
      continue
    }
    if (sensitiveNames.test(file) && !file.endsWith('.example')) {
      findings.push(file)
      continue
    }
    if (!/\.(?:[cm]?[jt]sx?|json|ya?ml|html|txt|md|sh|py)$|(?:^|\/)\.npmrc$/.test(file)) continue
    const content = await readFile(path, 'utf8')
    if (secretMarkers.some((pattern) => pattern.test(content))) findings.push(file)
  }
  if (findings.length) throw new Error(`Fichiers à examiner : ${findings.join(', ')}.`)
  return { filesExamined: new Set(files).size }
}

export async function scanClient(root) {
  const directory = resolve(root, 'dist/assets')
  const scripts = (await readdir(directory)).filter((file) => file.endsWith('.js'))
  if (!scripts.length) throw new Error('Aucun JavaScript client produit.')
  for (const script of scripts) {
    const contents = await readFile(resolve(directory, script), 'utf8')
    if (secretMarkers.some((pattern) => pattern.test(contents))) throw new Error(`Secret potentiel dans ${script}.`)
  }
  return scripts.length
}

export async function measureBudgets(root, output, limits) {
  const assets = resolve(root, 'dist/assets')
  const sizes = {}
  for (const name of (await readdir(assets)).filter((file) => file.endsWith('.js')).sort()) {
    const bytes = await readFile(resolve(assets, name))
    sizes[name] = { bytes: bytes.length, gzipBytes: gzipSync(bytes).length }
  }
  const sum = (pattern) => Object.entries(sizes).filter(([file]) => pattern.test(file)).reduce((total, [, size]) => total + size.gzipBytes, 0)
  const catalogue = sum(/^Formations-/)
  const playable = sum(/^(?!Formations-)/)
  const values = { playable, catalogue, limits, assets: sizes }
  await writeFile(resolve(output, 'budgets.json'), JSON.stringify(values, null, 2) + '\n')
  if (!sum(/^index-/) || !sum(/^createCampus-/) || !catalogue || playable > limits.playableJavaScriptGzipBytes || catalogue > limits.catalogueJavaScriptGzipBytes) {
    throw new Error(`Budget gzip dépassé ou module absent. Jeu : ${playable} octets. Catalogue : ${catalogue} octets.`)
  }
  return values
}
