import { describe, expect, it } from 'vitest'
import { bounds, cameraTarget, cameraZoom, facing, headingTo, interpolateCamera, interactionRadius, movement, nearbyStation, obstacles, start, stationAt, stations, walk, walkable, walkingPace } from './campus'
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

describe('Cadre et guidage du campus', () => {
  it('adapte le cadre au viewport et conserve une vue fixe pour la réduction des animations', () => {
    expect(cameraZoom(390, false)).toBeGreaterThan(cameraZoom(900, false))
    expect(cameraZoom(390, true)).toBe(1)
    expect(cameraTarget(start, 1)).toEqual({ x: 480, y: 270 })
    const zoom = cameraZoom(390, false)
    const corner = cameraTarget({ x: bounds.left, y: bounds.top }, zoom)
    expect(corner.x).toBeCloseTo(960 / 2 / zoom)
    expect(corner.y).toBeCloseTo(540 / 2 / zoom)
    expect(cameraTarget({ x: 800, y: 430 }, zoom).x).toBeGreaterThan(corner.x)
  })

  it('maintient le cadrage interpolé dans les limites des cibles et lisse le démarrage', () => {
    const from = { x: 400, y: 250 }
    const to = { x: 560, y: 315 }
    expect(interpolateCamera(from, to, 0)).toEqual(from)
    const next = interpolateCamera(from, to, 16)
    expect(next.x).toBeGreaterThan(from.x)
    expect(next.x).toBeLessThan(to.x)
    expect(next.y).toBeGreaterThan(from.y)
    expect(interpolateCamera(from, to, 2000).x).toBeCloseTo(to.x)
    expect(walkingPace(0)).toBeLessThan(walkingPace(70))
    expect(walkingPace(145)).toBe(1)
    expect(walkingPace(300)).toBe(1)
    expect(walk(start, { x: 1, y: 0 }, 16, walkingPace(0)).x).toBeLessThan(walk(start, { x: 1, y: 0 }, 16).x)
  })

  it('repère la destination et la zone du marqueur sans étendre le rayon d’interaction', () => {
    const [station] = stations
    expect(station).toBeDefined()
    if (!station) throw new Error('Station attendue.')
    expect(headingTo(start, station)).toBe('nord')
    expect(stationAt({ x: station.x, y: station.y - 32 })).toBe(station.id)
    expect(stationAt({ x: station.x, y: station.y - 65 })).toBeNull()
    expect(nearbyStation(start)).toBeNull()
  })
})
