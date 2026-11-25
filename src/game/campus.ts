import type { StageId } from '../domain/mission'

export type Position = { x: number; y: number }
type Obstacle = { x: number; y: number; width: number; height: number }

export const size = { width: 960, height: 540 }
export const bounds = { left: 35, right: 925, top: 215, bottom: 510 }
export const start = { x: 120, y: 435 }
export const speed = 176
export const interactionRadius = 66

export const stations: readonly (Position & { id: StageId; label: string })[] = [
  { id: 'besoin', x: 180, y: 278, label: 'Kiosque' },
  { id: 'interface', x: 488, y: 259, label: 'Atelier' },
  { id: 'test', x: 805, y: 370, label: 'Point de test' },
]

export const obstacles: readonly Obstacle[] = [
  { x: 270, y: 323, width: 108, height: 72 },
  { x: 623, y: 272, width: 95, height: 75 },
]

const footRadius = 10
const directions = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
}

export type Direction = keyof typeof directions

export function movement(keys: ReadonlySet<Direction>): Position {
  let x = 0
  let y = 0
  for (const key of keys) {
    x += directions[key].x
    y += directions[key].y
  }
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

export function facing(vector: Position): Direction {
  if (Math.abs(vector.x) > Math.abs(vector.y)) return vector.x < 0 ? 'left' : 'right'
  return vector.y < 0 ? 'up' : 'down'
}

export function walkable({ x, y }: Position): boolean {
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
    && obstacles.every((obstacle) => (
      x <= obstacle.x - footRadius || x >= obstacle.x + obstacle.width + footRadius
      || y <= obstacle.y - footRadius || y >= obstacle.y + obstacle.height + footRadius
    ))
}

export function walk(position: Position, vector: Position, deltaMs: number): Position {
  const distance = speed * Math.min(Math.max(deltaMs, 0), 50) / 1000
  const next = { x: Math.min(bounds.right, Math.max(bounds.left, position.x + vector.x * distance)), y: position.y }
  if (!walkable(next)) next.x = position.x
  next.y = Math.min(bounds.bottom, Math.max(bounds.top, position.y + vector.y * distance))
  if (!walkable(next)) next.y = position.y
  return next
}

export function nearbyStation(position: Position): StageId | null {
  return stations.find((station) => Math.hypot(position.x - station.x, position.y - station.y) <= interactionRadius)?.id ?? null
}
