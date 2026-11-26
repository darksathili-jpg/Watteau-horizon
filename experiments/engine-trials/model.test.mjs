import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canInteract, fresh, isWalkable, move, persisted, resetFrom, scene, speed } from './model.mjs'

test('le trajet, les repères et le départ sont hors des surfaces de collision', () => {
  assert.equal(isWalkable(scene.start.x, scene.start.z), true)
  for (const station of scene.stations) assert.equal(isWalkable(station.x, station.z), true)
  for (const item of [...scene.obstacles, ...scene.buildings]) assert.equal(isWalkable(item.x, item.z), false)
  assert.equal(isWalkable(12, 0), false)
})

test('un déplacement diagonal garde la même vitesse et un pas borné', () => {
  const state = fresh()
  const before = { ...state }
  move(state, ['right', 'up'], 9)
  assert.ok(Math.abs(Math.hypot(state.x - before.x, state.z - before.z) - speed * 0.05) < 0.00001)
  assert.equal(state.walking, true)
})

test('la collision arrête le pas et un chemin latéral reste possible', () => {
  const state = { ...fresh(), x: -4 }
  for (let index = 0; index < 100; index += 1) move(state, ['up'], 1 / 60)
  assert.ok(state.z >= 3.14 && state.z < 3.22)
  assert.equal(state.walking, false)
  move(state, ['left'], 1 / 60)
  assert.ok(state.x < -4)
})

test('le même ordre des repères est imposé, avec accès direct sans jeu', () => {
  const state = fresh()
  assert.equal(canInteract(state, false), false)
  assert.equal(canInteract(state, true), true)
  state.x = scene.stations[0].x
  state.z = scene.stations[0].z
  assert.equal(canInteract(state, false), true)
  state.active = 1
  assert.equal(canInteract(state, false), false)
  state.active = 3
  assert.equal(canInteract(state, true), false)
})

test('réduction du mouvement et reconstruction d’un enregistrement versionné', () => {
  const state = { ...fresh(), reduced: true, active: 2, note: 'Texte synthétique' }
  move(state, ['right'], 0.025)
  assert.equal(state.step, 0)
  assert.equal(state.cameraX, state.x)
  assert.deepEqual(persisted(resetFrom(persisted(state))), persisted(state))
  const fallback = resetFrom({ ...persisted(state), version: 999 })
  assert.deepEqual(fallback, fresh())
})
