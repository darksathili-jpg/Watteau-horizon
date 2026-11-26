import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { browserTests, checkAttestation, combine, decide, gates, sha256, verifyPrivacyPolicy } from './checks.mjs'

const pass = { status: 'PASS' }
const fail = { status: 'FAIL' }
const blocked = { status: 'BLOCKED' }
const allPass = gates.map((id) => ({ id, ...pass }))

test('un échec et un résultat manquant gardent des états différents', () => {
  assert.equal(combine([pass, blocked]), 'BLOCKED')
  assert.equal(combine([blocked, fail]), 'FAIL')
  assert.equal(combine([]), 'BLOCKED')
  assert.equal(combine([pass, pass]), 'PASS')
})

test('le développement peut aboutir avec Q8 bloquée, le profil élèves échoue', () => {
  const reviewPending = [...allPass.slice(0, -1), { id: 'Q8', ...blocked }]
  assert.deepEqual(decide(reviewPending, 'development', 'BLOCKED'), { automated: 'PASS', studentRelease: 'BLOCKED', exitCode: 0 })
  assert.equal(decide(reviewPending, 'students', 'BLOCKED').exitCode, 1)
  assert.equal(decide(reviewPending, 'students', 'PASS').studentRelease, 'BLOCKED')
  assert.deepEqual(decide(allPass, 'students', 'PASS'), { automated: 'PASS', studentRelease: 'PASS', exitCode: 0 })
})

test('aucune attestation ne neutralise un contrôle critique en échec ou omis', () => {
  const gateFailure = allPass.map((gate) => gate.id === 'Q6' ? { ...gate, ...fail } : gate)
  assert.equal(decide(gateFailure, 'students', 'PASS').exitCode, 1)
  assert.equal(decide(gateFailure, 'development', 'PASS').exitCode, 1)
  assert.equal(decide(allPass.slice(1), 'students', 'PASS').studentRelease, 'BLOCKED')
  assert.equal(decide([{ id: 'Q3', ...pass }], 'development', undefined, true).exitCode, 0)
})

test('un scénario Playwright ignoré ou attendu en échec ne compte jamais comme réussi', () => {
  const browserTest = (title, status, expectedStatus, result) => ({
    title,
    tests: [{ status, expectedStatus, results: [{ status: result }] }],
  })
  const report = { suites: [{ specs: [
    browserTest('exécuté', 'expected', 'passed', 'passed'),
    browserTest('ignoré', 'skipped', 'skipped', 'skipped'),
    browserTest('échec attendu', 'expected', 'failed', 'failed'),
  ] }] }
  assert.deepEqual([...browserTests(report)], [['exécuté', true], ['ignoré', false], ['échec attendu', false]])
})

test('un recul de CSP ou une directive de script supplémentaire est refusé', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8')
  verifyPrivacyPolicy(html)
  assert.throws(() => verifyPrivacyPolicy(html.replace("connect-src 'self'", 'connect-src *')))
  assert.throws(() => verifyPrivacyPolicy(html.replace("script-src 'self';", "script-src 'self'; script-src-elem *;")))
  assert.throws(() => verifyPrivacyPolicy(html.replace('no-referrer', 'origin')))
})

test('une attestation est liée au checkout propre et aux empreintes de ses pièces', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'watteau-review-'))
  try {
    const directory = join(folder, 'review')
    await mkdir(directory)
    const attestation = join(directory, 'attestation.json')
    const proof = 'Pièce synthétique du test unitaire du harness.'
    await writeFile(join(directory, 'proof.txt'), proof)
    await writeFile(join(folder, 'outside.txt'), proof)
    const state = { commit: 'a'.repeat(40), subjectSha256: '0'.repeat(64), dirty: false }
    const review = { status: 'verified', approver: 'Rôle fictif', date: '2026-01-01', file: 'proof.txt', sha256: sha256(proof) }
    const document = { schema: 1, ...state, reviews: { 'art-rights': review } }
    assert.equal((await checkAttestation(undefined, state, ['art-rights'])).status, 'BLOCKED')
    await writeFile(attestation, JSON.stringify(document))
    assert.equal((await checkAttestation(attestation, state, ['art-rights'])).status, 'PASS')
    assert.equal((await checkAttestation(attestation, { ...state, dirty: true }, ['art-rights'])).status, 'BLOCKED')
    assert.equal((await checkAttestation(attestation, state, ['art-rights', 'institutional-authorization'])).status, 'BLOCKED')
    await writeFile(join(directory, 'proof.txt'), 'Autre pièce')
    assert.equal((await checkAttestation(attestation, state, ['art-rights'])).status, 'BLOCKED')
    document.reviews['art-rights'].file = '../outside.txt'
    await writeFile(attestation, JSON.stringify(document))
    assert.equal((await checkAttestation(attestation, state, ['art-rights'])).status, 'BLOCKED')
  } finally {
    await rm(folder, { recursive: true })
  }
})
