import { getActiveSkillsetAbilities } from '@/lib/skillset.abilities'

describe('getActiveSkillsetAbilities', () => {
  const enabled = { id: 'a1', name: 'one', state: 'enabled' }
  const disabled = { id: 'a2', name: 'two', state: 'disabled' }
  const unset = { id: 'a3', name: 'three' }

  it('returns [] for a null or undefined skillset', () => {
    expect(getActiveSkillsetAbilities(null)).toEqual([])
    expect(getActiveSkillsetAbilities(undefined)).toEqual([])
  })

  it('returns [] when the skillset itself is disabled, even with enabled abilities', () => {
    expect(
      getActiveSkillsetAbilities({
        state: 'disabled',
        abilities: [enabled, unset],
      })
    ).toEqual([])
  })

  it('excludes explicitly disabled abilities', () => {
    expect(
      getActiveSkillsetAbilities({
        state: 'enabled',
        abilities: [enabled, disabled, unset],
      })
    ).toEqual([enabled, unset])
  })

  it('includes abilities with an unset state (blacklist semantics)', () => {
    expect(
      getActiveSkillsetAbilities({ state: 'enabled', abilities: [unset] })
    ).toEqual([unset])
  })

  it('treats an unset skillset state as active', () => {
    expect(getActiveSkillsetAbilities({ abilities: [enabled] })).toEqual([
      enabled,
    ])
  })

  it('returns [] when there are no abilities', () => {
    expect(getActiveSkillsetAbilities({ state: 'enabled' })).toEqual([])
    expect(
      getActiveSkillsetAbilities({ state: 'enabled', abilities: [] })
    ).toEqual([])
  })
})
