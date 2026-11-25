import { describe, expect, it } from 'vitest'
import { completeStage, emptyReflection, hasReflection, isMissionComplete, stages } from './mission'
import type { StageId } from './mission'

describe('Mission numérique', () => {
  it('rend chaque étape atteignable sans score et dans le même ordre', () => {
    const route = stages.reduce<StageId[]>((done, stage) => {
      expect(stage.options.filter(({ advance }) => advance)).toHaveLength(1)
      expect(isMissionComplete(done)).toBe(false)
      return completeStage(done, stage.id)
    }, [])
    expect(isMissionComplete(route)).toBe(true)
    expect(completeStage(route, 'test')).toEqual(route)
    expect(completeStage([], 'test')).toEqual([])
    expect(isMissionComplete(['test', 'interface', 'besoin'])).toBe(false)
  })

  it('considère une réflexion séparément des étapes', () => {
    expect(hasReflection(emptyReflection())).toBe(false)
    expect(hasReflection({ ...emptyReflection(), interest: '    ' })).toBe(false)
    expect(hasReflection({ ...emptyReflection(), skill: 'Faire un entretien' })).toBe(true)
  })
})
