import layout from './scene.json' with { type: 'json' }

export const scene = layout
export const radius = 0.34
export const reach = 1.25
export const speed = 4.5
export const keys = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] }

export function isWalkable(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)
    || Math.abs(x) > scene.world.width / 2 - radius || Math.abs(z) > scene.world.depth / 2 - radius) return false
  return [...scene.obstacles, ...scene.buildings].every((item) => (
    Math.abs(x - item.x) >= item.w / 2 + radius || Math.abs(z - item.z) >= item.d / 2 + radius
  ))
}

export function fresh() {
  return { ...scene.start, yaw: Math.PI, walking: false, step: 0, active: 0, reduced: false, cameraX: scene.start.x, cameraZ: scene.start.z, note: '' }
}

export function resetFrom(input) {
  const state = fresh()
  if (!input || input.version !== 1) return state
  if (isWalkable(input.x, input.z)) {
    state.x = state.cameraX = input.x
    state.z = state.cameraZ = input.z
  }
  if (Number.isFinite(input.yaw)) state.yaw = input.yaw
  if (Number.isInteger(input.active) && input.active >= 0 && input.active <= scene.stations.length) state.active = input.active
  if (typeof input.reduced === 'boolean') state.reduced = input.reduced
  if (typeof input.note === 'string') state.note = input.note.slice(0, 300)
  return state
}

export function move(state, held, rawDelta) {
  const delta = Math.min(0.05, Math.max(0, rawDelta))
  let dx = 0
  let dz = 0
  for (const direction of held) {
    const vector = keys[direction]
    if (vector) {
      dx += vector[0]
      dz += vector[1]
    }
  }
  const length = Math.hypot(dx, dz)
  let x = state.x
  let z = state.z
  if (length) {
    const distance = delta * speed / length
    const nextX = x + dx * distance
    if (isWalkable(nextX, z)) x = nextX
    const nextZ = z + dz * distance
    if (isWalkable(x, nextZ)) z = nextZ
    state.yaw = Math.atan2(dx, dz)
  }
  const travelled = Math.hypot(state.x - x, state.z - z)
  state.walking = travelled > 0
  state.step = state.reduced ? 0 : state.step + travelled * 8.4
  state.x = x
  state.z = z
  const mix = state.reduced ? 1 : 1 - Math.exp(-11 * delta)
  state.cameraX += (x - state.cameraX) * mix
  state.cameraZ += (z - state.cameraZ) * mix
}

export function canInteract(state, accessible) {
  const station = scene.stations[state.active]
  return Boolean(station && (accessible || Math.hypot(state.x - station.x, state.z - station.z) <= reach))
}

export function persisted(state) {
  const { x, z, yaw, active, reduced, note } = state
  return { version: 1, x, z, yaw, active, reduced, note }
}
