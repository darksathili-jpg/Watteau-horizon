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

export function walk(position: Position, vector: Position, deltaMs: number, pace = 1): Position {
  const distance = speed * Math.min(Math.max(deltaMs, 0), 50) / 1000 * pace
  const next = { x: Math.min(bounds.right, Math.max(bounds.left, position.x + vector.x * distance)), y: position.y }
  if (!walkable(next)) next.x = position.x
  next.y = Math.min(bounds.bottom, Math.max(bounds.top, position.y + vector.y * distance))
  if (!walkable(next)) next.y = position.y
  return next
}

export function nearbyStation(position: Position): StageId | null {
  return stations.find((station) => Math.hypot(position.x - station.x, position.y - station.y) <= interactionRadius)?.id ?? null
}

const headings = ['est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest', 'nord', 'nord-est'] as const
export type Heading = (typeof headings)[number]

export function headingTo(position: Position, destination: Position): Heading {
  const angle = Math.atan2(destination.y - position.y, destination.x - position.x)
  const sector = Math.round(angle / (Math.PI / 4))
  return headings[(sector + headings.length) % headings.length]!
}

export function walkingPace(heldMs: number): number {
  return 0.52 + 0.48 * Math.min(1, Math.max(0, heldMs) / 145)
}

export function cameraZoom(viewWidth: number, fixed: boolean): number {
  if (fixed) return 1
  return viewWidth < 560 ? 1.64 : 1.2
}

export function cameraTarget(player: Position, zoom: number): Position {
  const halfWidth = size.width / (2 * zoom)
  const halfHeight = size.height / (2 * zoom)
  return {
    x: Math.max(halfWidth, Math.min(size.width - halfWidth, player.x)),
    y: Math.max(halfHeight, Math.min(size.height - halfHeight, player.y - halfHeight * 0.46)),
  }
}

export function interpolateCamera(current: Position, target: Position, deltaMs: number): Position {
  const blend = 1 - Math.exp(-Math.max(0, deltaMs) / 105)
  return {
    x: Math.abs(target.x - current.x) < 0.08 ? target.x : current.x + (target.x - current.x) * blend,
    y: Math.abs(target.y - current.y) < 0.08 ? target.y : current.y + (target.y - current.y) * blend,
  }
}

export function stationAt(position: Position): StageId | null {
  return stations.find((station) => (
    Math.abs(position.x - station.x) <= 53
    && position.y >= station.y - 49 && position.y <= station.y + 19
  ))?.id ?? null
}
