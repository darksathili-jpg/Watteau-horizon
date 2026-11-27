import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { processResult, scanClient, scanRepository } from '../harness/checks.mjs'

const root = process.cwd()
const p4 = resolve(root, 'experiments/artistic-slice')
const target = process.argv[2]
if (!target) throw new Error('Usage : node tools/artistic-slice/run.mjs <dossier neuf>')
const out = resolve(target)
await mkdir(out)
const startedAt = new Date().toISOString()
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim()
const steps = {}

async function command(id, executable, args, cwd = root, timeout = 360_000) {
  const result = await processResult(executable, args, { cwd, timeout, env: process.env })
  const file = `${id}.txt`
  await writeFile(resolve(out, file), `$ ${executable} ${args.join(' ')}\nCode : ${result.code ?? 'indisponible'}\n${result.stdout}${result.stderr}${result.error?.message ?? ''}\n`)
  steps[id] = { status: result.error || result.timedOut ? 'BLOCKED' : result.code === 0 ? 'PASS' : 'FAIL', code: result.code, file }
  console.log(id, steps[id].status)
  return steps[id].status
}

const baseline = JSON.parse(await readFile('production/baseline.json', 'utf8'))
const protectedPaths = ['AGENTS.md', 'production', 'tools/harness', '.agents/skills', '.github', 'src', 'public', 'data', 'tests', 'package.json', 'package-lock.json', 'index.html', 'experiments/engine-trials']
const changed = execFileSync('git', ['diff', '--name-only', '3efa2b8', '--', ...protectedPaths]).toString().trim()
steps.reference = { status: changed ? 'FAIL' : 'PASS', p3Revision: '3efa2b8', historicalRevision: baseline.revision, changed }
await command('models', process.execPath, ['art/inventory.mjs', `--validator-out=${resolve(out, 'validator.json')}`], p4)
await command('unit', 'npm', ['test'], p4)
await command('build', 'npm', ['run', 'build'], p4)
await command('audit', 'npm', ['audit', '--audit-level=moderate', '--json'], p4, 90_000)
try {
  steps.secrets = { status: 'PASS', ...await scanRepository(root), sourceBundles: await scanClient(p4) }
} catch (error) {
  steps.secrets = { status: 'FAIL', error: error.message }
}
if (steps.build.status === 'PASS') {
  await command('browser', process.execPath, ['tools/artistic-slice/receipt.mjs', resolve(out, 'browser')])
  await command('performance', process.execPath, ['tools/artistic-slice/benchmark.mjs', resolve(out, 'performance')])
  await command('video', process.execPath, ['tools/artistic-slice/benchmark.mjs', resolve(out, 'video'), '--video'])
} else {
  for (const step of ['browser', 'performance', 'video']) steps[step] = { status: 'BLOCKED', reason: 'Build P4 indisponible' }
}
steps.device = { status: 'NOT_RUN', reason: 'Les trois appareils physiques du protocole ne sont pas disponibles dans cet environnement.' }
steps.artReview = { status: 'BLOCKED', reason: 'Revue humaine et pièces ART-03 absentes.' }
steps.manualAccessibility = { status: 'NOT_RUN', reason: 'Revue formelle avec lecteur d’écran sur les appareils cibles non exécutée.' }
steps.students = { status: 'BLOCKED', reason: 'Le profil historique quality:students et les six attestations authentiques contrôlent Q8.' }
const report = { revision, startedAt, finishedAt: new Date().toISOString(), steps }
await writeFile(resolve(out, 'profile.json'), JSON.stringify(report, null, 2) + '\n')
if (Object.entries(steps).some(([id, { status }]) => !['device', 'artReview', 'manualAccessibility', 'students'].includes(id) && status !== 'PASS')) process.exitCode = 1
