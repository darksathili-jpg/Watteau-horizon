import { emptyReflection, reflectionFields, reflectionLimit, stages } from '../domain/mission'
import type { Reflection, StageId } from '../domain/mission'
import { start, walkable } from '../game/campus'
import type { Position } from '../game/campus'

export type Mode = 'game' | 'accessible'

export interface Save {
  version: 1
  mode: Mode
  completed: StageId[]
  reflection: Reflection
  position: Position
  reduceMotion: boolean | null
}

export const storageKey = 'watteau-horizon:v1'
export type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type StorageProvider = () => StorageAccess

export function freshSave(): Save {
  return { version: 1, mode: 'game', completed: [], reflection: emptyReflection(), position: { ...start }, reduceMotion: null }
}

export function decodeSave(raw: string): Save {
  const input: unknown = JSON.parse(raw)
  if (typeof input !== 'object' || input === null || !('version' in input) || input.version !== 1) {
    throw new Error('Version de sauvegarde inconnue.')
  }

  const value = input as Partial<Save>
  const save = freshSave()
  if (value.mode === 'accessible') save.mode = value.mode
  if (typeof value.reduceMotion === 'boolean') save.reduceMotion = value.reduceMotion
  if (Array.isArray(value.completed)) {
    for (const { id } of stages) {
      if (value.completed[save.completed.length] !== id) break
      save.completed.push(id)
    }
  }
  if (value.position && walkable(value.position)) save.position = { x: value.position.x, y: value.position.y }
  for (const { key } of reflectionFields) {
    const entry = value.reflection?.[key]
    if (typeof entry === 'string') save.reflection[key] = entry.slice(0, reflectionLimit)
  }
  return save
}

export function readSave(storage: StorageProvider): { save: Save; problem: string | null } {
  try {
    const raw = storage().getItem(storageKey)
    return { save: raw === null ? freshSave() : decodeSave(raw), problem: null }
  } catch {
    return { save: freshSave(), problem: 'La sauvegarde locale est indisponible ou illisible. Tu peux continuer et exporter ton carnet pendant cette session.' }
  }
}

export function writeSave(storage: StorageProvider, save: Save): boolean {
  try {
    storage().setItem(storageKey, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

export function eraseSave(storage: StorageProvider): boolean {
  try {
    storage().removeItem(storageKey)
    return true
  } catch {
    return false
  }
}

export function exportSave(save: Save): string {
  return JSON.stringify(save, null, 2) + '\n'
}
