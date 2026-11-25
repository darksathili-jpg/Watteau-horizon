import { describe, expect, it } from 'vitest'
import { start } from '../game/campus'
import { decodeSave, eraseSave, exportSave, freshSave, readSave, storageKey, writeSave } from './save'
import type { StorageAccess } from './save'

function memoryStorage(): StorageAccess {
  const records = new Map<string, string>()
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value) },
    removeItem: (key) => { records.delete(key) },
  }
}

describe('Carnet local versionné', () => {
  it('conserve progression, position, mode, préférences et réflexion dans l’export', () => {
    const memory = memoryStorage()
    const getStorage = () => memory
    const value = freshSave()
    value.position = { x: 180, y: 278 }
    value.completed = ['besoin']
    value.reflection.interest = 'Essai synthétique'
    value.mode = 'accessible'
    value.reduceMotion = true
    expect(writeSave(getStorage, value)).toBe(true)
    expect(readSave(getStorage)).toEqual({ save: value, problem: null })
    expect(JSON.parse(exportSave(value))).toEqual(value)
    memory.setItem('another-app', 'intact')
    expect(eraseSave(getStorage)).toBe(true)
    expect(memory.getItem(storageKey)).toBeNull()
    expect(memory.getItem('another-app')).toBe('intact')
  })

  it('ramène des données hors des limites aux valeurs sûres', () => {
    const value = decodeSave(JSON.stringify({
      version: 1, mode: 'unknown', completed: ['besoin', 'test'], position: { x: 300, y: 350 },
      reflection: { interest: 'x'.repeat(900), constraint: { malformed: true } },
    }))
    expect(value.completed).toEqual(['besoin'])
    expect(value.position).toEqual(start)
    expect(value.mode).toBe('game')
    expect(value.reflection.interest).toHaveLength(400)
    expect(value.reflection.constraint).toBe('')
  })

  it('signale le stockage inaccessible et la version incompatible', () => {
    const blocked = () => { throw new Error('Disabled') }
    expect(readSave(blocked).problem).toBeTruthy()
    expect(writeSave(blocked, freshSave())).toBe(false)
    expect(eraseSave(blocked)).toBe(false)
    expect(() => decodeSave('{"version":2}')).toThrow()
    expect(() => decodeSave('invalid JSON')).toThrow()
  })
})
