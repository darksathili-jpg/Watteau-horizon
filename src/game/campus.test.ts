import { describe, expect, it } from 'vitest'
import { bounds, facing, interactionRadius, movement, nearbyStation, obstacles, start, stations, walk, walkable } from './campus'
import type { Position } from './campus'

const repeatWalk = (position: Position, vector: Position, times: number) => {
  for (let step = 0; step < times; step += 1) position = walk(position, vector, 16)
  return position
}

describe('Déplacements du campus', () => {
  it('normalise les diagonales, traite les sens opposés et donne la bonne orientation', () => {
    const diagonal = movement(new Set(['right', 'up']))
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1)
    expect(facing(diagonal)).toBe('up')
    expect(facing(movement(new Set(['left'])))).toBe('left')
    expect(movement(new Set(['up', 'down']))).toEqual({ x: 0, y: 0 })
  })

  it('respecte les limites et résiste aux images espacées', () => {
    expect(repeatWalk(start, { x: -1, y: 0 }, 100).x).toBe(bounds.left)
    expect(repeatWalk(start, { x: 0, y: 1 }, 100).y).toBe(bounds.bottom)
    expect(walk(start, { x: 1, y: 0 }, 5000)).toEqual(walk(start, { x: 1, y: 0 }, 50))
    expect(walkable({ x: Number.NaN, y: 350 })).toBe(false)
  })

  it('bloque les deux jardinières et permet de les contourner', () => {
    for (const obstacle of obstacles) {
      const from = { x: obstacle.x - 30, y: obstacle.y + obstacle.height / 2 }
      const stopped = repeatWalk(from, { x: 1, y: 0 }, 65)
      expect(walkable(stopped)).toBe(true)
      expect(stopped.x).toBeLessThanOrEqual(obstacle.x - 10)
      expect(stopped.x).toBeGreaterThan(obstacle.x - 15)
    }
    const detour = repeatWalk({ x: 240, y: 308 }, { x: 1, y: 0 }, 66)
    expect(detour.x).toBeGreaterThan(378)
  })

  it('détecte seulement un point dans son rayon', () => {
    expect(nearbyStation(start)).toBeNull()
    for (const station of stations) {
      expect(walkable(station)).toBe(true)
      expect(nearbyStation(station)).toBe(station.id)
      expect(nearbyStation({ x: station.x - interactionRadius, y: station.y })).toBe(station.id)
      expect(nearbyStation({ x: station.x - interactionRadius - 1, y: station.y })).toBeNull()
    }
  })
})
