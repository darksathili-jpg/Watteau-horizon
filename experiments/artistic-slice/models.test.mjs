import assert from 'node:assert/strict'
import test from 'node:test'
import { advance, direction, distance, interactionDistance, markers, obstacles, start, walkable } from './world.mjs'

test('le départ et les trois zones d’interaction sont atteignables sans traverser Antoine', () => {
  assert(walkable(start.x, start.z))
  const point = { ...start }
  advance(point, 0, -14)
  assert(point.z >= -1.31)
  assert(distance(point, markers[0]) <= interactionDistance)
  advance(point, -7, 0)
  advance(point, 0, -4)
  assert(distance(point, markers[1]) <= interactionDistance)
  advance(point, 15, 0)
  assert(distance(point, markers[2]) <= interactionDistance)
  assert(!walkable(markers[0].x, markers[0].z))
})

test('les sept volumes solides, les limites et les valeurs non finies bloquent le déplacement', () => {
  for (const [left, right, back, front] of obstacles) assert(!walkable((left + right) / 2, (back + front) / 2))
  for (const point of [[0, -20], [0, 14], [14, 0], [-14, 0], [Infinity, 0], [0, NaN]]) assert(!walkable(...point))
  const point = { x: 4, z: -10 }
  advance(point, 0, -30)
  assert(point.z <= -11 && point.z >= -11.23)
  advance(point, 3, -1)
  assert(point.x > 6.9)
})

test('les diagonales gardent la même vitesse et les directions opposées se neutralisent', () => {
  const [x, z] = direction(new Set(['left', 'forward', 'run']))
  assert(x < 0 && z < 0)
  assert(Math.abs(Math.hypot(x, z) - 1) < 1e-12)
  assert.deepEqual(direction(new Set(['left', 'right', 'forward', 'back'])), [0, 0])
})
