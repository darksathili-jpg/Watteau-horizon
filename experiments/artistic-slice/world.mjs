import { stages } from '../../src/domain/mission.ts'

export const start = Object.freeze({ x: 0, z: 7.8 })
export const markers = stages.map(({ id, place }, index) => ({
  id, place, x: [0, -7, 8][index], z: [-2, -5, -6][index],
}))
export const obstacles = [
  [-15.3, 15.3, -18.5, -11.55],
  [-17.6, -14.1, -12.5, 10.2],
  [14.1, 17.6, -12.5, 10.2],
  [-8.6, -4.6, -.1, 6],
  [7.1, 10.5, -2.1, 4.6],
  [-12.4, -8.65, -9.7, -7.9],
  [10.1, 13.25, -9.4, -7.5],
  [-.35, .35, -2.36, -1.64],
]
export const interactionDistance = 2.05
const radius = .33
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

export function walkable(x, z) {
  return Number.isFinite(x) && Number.isFinite(z)
    && x >= -13.7 && x <= 13.7 && z >= -12 && z <= 13.4
    && !obstacles.some(([left, right, back, front]) =>
      x > left - radius && x < right + radius && z > back - radius && z < front + radius)
}

function moveAxis(position, axis, amount) {
  if (!amount) return
  const from = position[axis]
  const canMove = (part) => axis === 'x'
    ? walkable(from + amount * part, position.z)
    : walkable(position.x, from + amount * part)
  if (canMove(1)) {
    position[axis] = from + amount
    return
  }

  // Resolve the reachable part of a blocked substep for stable contact across frame rates.
  let free = 0
  let blocked = 1
  for (let index = 0; index < 9; index++) {
    const middle = (free + blocked) / 2
    if (canMove(middle)) free = middle
    else blocked = middle
  }
  position[axis] = from + amount * free
}

export function advance(position, x, z) {
  // Small substeps keep collisions sound at wall corners and on slow devices.
  const steps = Math.max(1, Math.ceil(Math.hypot(x, z) / .15))
  for (let step = 0; step < steps; step++) {
    moveAxis(position, 'x', x / steps)
    moveAxis(position, 'z', z / steps)
  }
}

export const movementKeys = {
  ArrowLeft: 'left', a: 'left', q: 'left',
  ArrowRight: 'right', d: 'right',
  ArrowUp: 'forward', w: 'forward', z: 'forward',
  ArrowDown: 'back', s: 'back', Shift: 'run',
}

export function direction(keys) {
  const x = Number(keys.has('right')) - Number(keys.has('left'))
  const z = Number(keys.has('back')) - Number(keys.has('forward'))
  const length = Math.hypot(x, z) || 1
  return [x / length, z / length]
}
