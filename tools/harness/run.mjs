import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  browserTests, checkAttestation, combine, decide, gates, git, measureBudgets, processResult,
  readJson, scanClient, scanRepository, subject, verifyPrivacyPolicy, verifyReference,
} from './checks.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const { values } = parseArgs({ options: {
  profile: { type: 'string', default: 'development' },
  guardian: { type: 'string' },
  out: { type: 'string' },
  attestation: { type: 'string' },
} })
if (!['development', 'students'].includes(values.profile)) throw new Error('Profil attendu : development ou students.')
if (values.profile === 'students' && values.guardian) throw new Error('Le profil élèves exige les huit barrières.')

const config = await readJson(resolve(root, 'production/quality.json'))
const baseline = await readJson(resolve(root, 'production/baseline.json'))
const guardianGates = Object.values(config.guardians).flat()
if (config.schema !== 1 || baseline.schema !== 1 || guardianGates.toSorted().join() !== gates.join()
  || Object.keys(config.guardians).length !== 6 || new Set(config.studentReviews).size !== 6 || config.studentReviews.length !== 6
  || config.visual.maximumChangedPixels !== 0) throw new Error('Configuration des barrières invalide.')
if (values.guardian && !Object.hasOwn(config.guardians, values.guardian)) throw new Error(`Guardian inconnu : ${values.guardian}.`)
const selected = values.guardian ? config.guardians[values.guardian] : gates
const startedAt = new Date().toISOString()
const stamp = startedAt.replace(/[:.]/g, '-')
const out = resolve(process.cwd(), values.out ?? join(root, 'quality-results', stamp))
await mkdir(dirname(out), { recursive: true })
await mkdir(out)
await mkdir(resolve(out, 'logs'))
const env = { ...process.env, VITE_WATTEAU_PREVIEW: '0', WATTEAU_EXPECT_PREVIEW: '0' }
delete env.NO_COLOR
delete env.FORCE_COLOR

const state = await subject(root).catch((error) => ({ error: error.message }))
const evidence = resolve(out, 'browser')
const unitFile = resolve(out, 'unit.json')
const playwrightFile = resolve(out, 'playwright.json')
const pending = { status: 'BLOCKED', summary: 'Prérequis indisponible.' }
const passed = (summary, artifact) => ({ status: 'PASS', summary, artifact })
const fail = (summary, artifact) => ({ status: 'FAIL', summary, artifact })
const steps = {}

async function command(id, executable, args, options = {}) {
  const commandLine = [executable, ...args].join(' ')
  const artifact = `logs/${id}.txt`
  const started = Date.now()
  console.log(`  ${commandLine}`)
  const result = await processResult(executable, args, { cwd: root, env, ...options })
  const durationMs = Date.now() - started
  const problem = result.error?.message ?? (result.timedOut ? 'Délai dépassé.' : '')
  await writeFile(resolve(out, artifact), `$ ${commandLine}\nCode de sortie : ${result.code ?? 'indisponible'}\n${result.stdout}${result.stderr}${problem}\n`)
  return {
    status: problem ? 'BLOCKED' : result.code === 0 ? 'PASS' : 'FAIL',
    summary: problem || `${executable} · code ${result.code}`,
    artifact, command: commandLine, exitCode: result.code, durationMs,
  }
}

async function step(id, perform) {
  if (steps[id]) return steps[id]
  try {
    steps[id] = await perform()
  } catch (error) {
    steps[id] = fail(error.message)
  }
  console.log(`  ${id} · ${steps[id].status} · ${steps[id].summary}`)
  return steps[id]
}

const checks = {
  baseline: () => step('baseline', async () => {
    if (state.error) return fail(state.error)
    const reference = await verifyReference(root, baseline, 'protectedTests')
    const original = JSON.parse(await git(root, 'show', `${baseline.revision}:package.json`))
    const current = await readJson(resolve(root, 'package.json'))
    for (const script of ['build', 'typecheck', 'test', 'test:e2e', 'check:static', 'catalogue:check']) {
      if (original.scripts[script] !== current.scripts[script]) return fail(`Commande validée modifiée : ${script}.`)
    }
    const artifact = 'baseline.json'
    await writeFile(resolve(out, artifact), JSON.stringify({ ...reference, state }, null, 2) + '\n')
    return passed(`${reference.files.length} fichiers de tests et commandes historiques intacts.`, artifact)
  }),
  self: () => step('self', () => command('self', 'npm', ['run', 'quality:test'])),
  build: () => step('build', () => command('build', 'npm', ['run', 'build'])),
  static: () => step('static', async () => (await checks.build()).status === 'PASS'
    ? command('static', 'npm', ['run', 'check:static']) : pending),
  unit: () => step('unit', async () => {
    const run = await command('unit', 'npm', ['test', '--', '--reporter=json', `--outputFile=${unitFile}`])
    if (run.status !== 'PASS') return run
    const stats = await readJson(unitFile)
    if (stats.numPassedTests < baseline.minimumUnitTests || stats.numFailedTests || stats.numPendingTests || !stats.success) {
      return fail('Couverture de la recette unitaire insuffisante ou cas non exécutés.', 'unit.json')
    }
    return { ...run, summary: `${stats.numPassedTests} tests unitaires réussis.`, report: 'unit.json' }
  }),
  browser: () => step('browser', async () => {
    if ((await checks.build()).status !== 'PASS') return pending
    await mkdir(evidence)
    const run = await command('browser', 'npm', ['run', 'test:e2e', '--', '--reporter=list,html,json'], {
      env: { ...env, WATTEAU_EVIDENCE_DIR: evidence, PLAYWRIGHT_JSON_OUTPUT_FILE: playwrightFile, PLAYWRIGHT_HTML_OUTPUT_DIR: resolve(out, 'playwright-html') },
    })
    if (run.status !== 'PASS') return run
    const report = await readJson(playwrightFile)
    const tests = [...browserTests(report).values()]
    if (tests.length < baseline.minimumBrowserTests || tests.some((passedTest) => !passedTest) || report.errors.length) {
      return fail('Un cas navigateur manque, a été ignoré ou a échoué.', 'playwright.json')
    }
    return { ...run, summary: `${tests.length} scénarios Chromium réussis.`, report: 'playwright.json' }
  }),
  art: () => step('art', async () => {
    const { files } = await verifyReference(root, baseline, 'art')
    return passed(`${files.length} visuels provisoires conformes au manifeste.`)
  }),
  visual: () => step('visual', async () => {
    if ((await checks.build()).status !== 'PASS') return pending
    const { visualComparison } = await import('./visual.mjs')
    return visualComparison({ root, out, baseline, policy: config.visual, command, env })
  }),
  axe: () => step('axe', async () => {
    const browser = await checks.browser()
    if (!browser.command) return pending
    const result = await readJson(playwrightFile).catch(() => null)
    if (!result) return { status: 'BLOCKED', summary: 'Rapport des scénarios axe absent.' }
    const report = browserTests(result)
    const known = [
      'respecte les préférences système et passe axe sur les vues et le dialogue',
      'compare deux fiches officielles, expose leur provenance et indique les données manquantes',
    ]
    if (known.some((test) => report.get(test) !== true)) return fail('Un scénario avec axe manque ou a échoué.', 'playwright.json')
    return passed('Les audits axe, le contrôle du mouvement et le comparateur ont été exécutés avec succès.', 'playwright.json')
  }),
  catalogue: () => step('catalogue', () => command('catalogue', 'npm', ['run', 'catalogue:check'])),
  catalogueTests: () => step('catalogueTests', () => command('catalogue-tests', 'npm', ['test', '--', 'src/data'])),
  secrets: () => step('secrets', async () => {
    const scan = await scanRepository(root)
    return passed(`${scan.filesExamined} fichiers de travail examinés sans signalement de secret courant.`)
  }),
  csp: () => step('csp', async () => {
    if ((await checks.build()).status !== 'PASS') return pending
    verifyPrivacyPolicy(await readFile(resolve(root, 'dist/index.html'), 'utf8'))
    const scripts = await scanClient(root)
    return passed(`CSP et référent vérifiés. ${scripts} modules client examinés sans signalement de secret courant.`)
  }),
  audit: () => step('audit', async () => {
    const run = await command('audit', 'npm', ['audit', '--audit-level=moderate', '--json'])
    const output = await readFile(resolve(out, run.artifact), 'utf8')
    const start = output.indexOf('\n{')
    const end = output.lastIndexOf('}')
    const raw = start >= 0 && end > start ? output.slice(start + 1, end + 1) : ''
    let parsed
    try { parsed = JSON.parse(raw) } catch { /* Le registre peut être indisponible. */ }
    const counts = parsed?.metadata?.vulnerabilities
    if (!counts || !Number.isSafeInteger(counts.total)) return { ...run, status: 'BLOCKED', summary: 'Le registre npm n’a fourni aucun bilan exploitable.' }
    const moderates = counts.moderate + counts.high + counts.critical
    if (!Number.isSafeInteger(moderates)) return { ...run, status: 'BLOCKED', summary: 'Gravités npm incomplètes.' }
    return { ...run, status: moderates > 0 ? 'FAIL' : run.status, summary: `${counts.total} vulnérabilité(s) signalée(s), dont ${moderates} de niveau modéré ou supérieur.` }
  }),
  engine: () => step('engine', async () => {
    const protocol = await readJson(resolve(root, 'production/engine-protocol.json'))
    if (protocol.schema !== 1 || protocol.control !== 'phaser-canvas' || new Set(protocol.candidates).size < 2
      || protocol.deviceClasses.length < 3 || protocol.scenarios.length < 6 || protocol.minimumColdRunsPerCombination < 5
      || protocol.movementSampleSeconds < 60 || protocol.state !== 'planned' || protocol.results.length !== 0
      || Object.values(protocol.proposedBudgets).some((value) => !Number.isFinite(value) || value < 0)) {
      return fail('Protocole 3D incomplet ou statut incompatible avec les résultats.')
    }
    return passed('Protocole 3D structuré. Expérimentation future, 0 résultat 3D déclaré.')
  }),
  performance: () => step('performance', async () => {
    const browser = await checks.browser()
    if (!browser.command) return pending
    const [desktop, mobile] = await Promise.all([
      readJson(resolve(evidence, 'performance.json')),
      readJson(resolve(evidence, 'performance-mobile.json')),
    ]).catch(() => [])
    if (!desktop || !mobile) return { status: 'BLOCKED', summary: 'Échantillons de performance Chromium incomplets.' }
    const values = [desktop.timeToReadyMs, desktop.animation?.p95Ms, desktop.observedPhaserFps, mobile.navigationToReadyMs, mobile.observedPhaserFps]
    if (values.some((value) => !Number.isFinite(value) || value <= 0) || desktop.animation.frames < 90 || mobile.viewport?.width !== 390) {
      return fail('Échantillons de performance Chromium invalides.')
    }
    return passed(`Desktop prêt en ${desktop.timeToReadyMs} ms, mobile émulé ${mobile.navigationToReadyMs} ms et p95 desktop ${desktop.animation.p95Ms} ms.`, 'browser/performance.json')
  }),
  budgets: () => step('budgets', async () => {
    if ((await checks.build()).status !== 'PASS') return pending
    const sizes = await measureBudgets(root, out, config.budgets)
    return passed(`Jeu ${sizes.playable} et catalogue ${sizes.catalogue} octets gzip, budgets respectés.`, 'budgets.json')
  }),
  approval: () => step('approval', async () => checkAttestation(values.attestation && resolve(process.cwd(), values.attestation), state, config.studentReviews)),
}

const definitions = {
  Q1: { title: 'Référence et compilation', checks: ['baseline', 'self', 'build', 'static'] },
  Q2: { title: 'Fonctionnalités et régressions', checks: ['unit', 'browser'] },
  Q3: { title: 'Visuels et comparaison', checks: ['art', 'visual'] },
  Q4: { title: 'Accessibilité automatisée', checks: ['axe'] },
  Q5: { title: 'Provenance et intégrité des données', checks: ['catalogue', 'catalogueTests'] },
  Q6: { title: 'Sécurité et confidentialité', checks: ['secrets', 'csp', 'audit', 'browser'] },
  Q7: { title: 'Mesures et protocole moteur', checks: ['engine', 'budgets', 'performance'] },
  Q8: { title: 'Autorisation de mise à disposition élèves', checks: ['approval'] },
}

const gateResults = []
const toRun = selected.includes('Q8') ? gates : selected
for (const id of toRun) {
  const definition = definitions[id]
  console.log(`${id} · ${definition.title}`)
  const results = []
  for (const key of definition.checks) results.push(await checks[key]())
  if (id === 'Q8') results.push(...gateResults)
  gateResults.push({ id, title: definition.title, checks: definition.checks, status: combine(results) })
}
const decision = decide(gateResults, values.profile, steps.approval?.status, Boolean(values.guardian))
const report = {
  schema: 1, profile: values.profile, guardian: values.guardian ?? null,
  startedAt,
  finishedAt: new Date().toISOString(), reference: baseline.revision, state, node: process.version,
  gates: gates.map((id) => gateResults.find((gate) => gate.id === id) ?? { id, title: definitions[id].title, status: 'NOT_RUN' }),
  checks: steps, decision,
}
await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const markdown = [
  '# Rapport de production Watteau Horizon', '',
  `Profil **${values.profile}** · révision \`${state.commit ?? 'inconnue'}\` · checkout ${state.dirty ? 'modifié' : state.error ? 'non vérifié' : 'propre'}.`,
  `Contrôles automatisés **${decision.automated}**. Mise à disposition élèves **${decision.studentRelease}**.`, '',
  '| Barrière | Résultat | Preuves |', '| --- | --- | --- |',
  ...report.gates.map((gate) => {
    const descriptions = (gate.checks ?? []).map((key) => {
      const check = steps[key]
      return check.artifact ? `[${key}](${check.artifact})` : `${key} · ${check.status}`
    })
    return `| ${gate.id} · ${gate.title} | ${gate.status} | ${descriptions.join(' · ')} |`
  }),
  '', '## Résultats détaillés', '',
  ...Object.entries(steps).map(([key, check]) => `- **${key}** · ${check.status} · ${check.summary.replaceAll('\n', ' ')}`),
  '',
]
await writeFile(resolve(out, 'report.md'), markdown.join('\n'))
console.log(`Rapport : ${resolve(out, 'report.md')}`)
process.exitCode = decision.exitCode
