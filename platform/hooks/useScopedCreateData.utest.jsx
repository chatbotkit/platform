import { scopeCreateData } from './useScopedCreateData'

describe('scopeCreateData', () => {
  it('adds the active project scope when no blueprint is present', () => {
    expect(
      scopeCreateData(
        { name: 'Scoped Resource' },
        { id: 'blueprint_123', name: 'Project' }
      )
    ).toEqual({
      name: 'Scoped Resource',
      blueprintId: 'blueprint_123',
    })
  })

  it('keeps an explicit blueprintId', () => {
    expect(
      scopeCreateData(
        { name: 'Explicit Resource', blueprintId: 'blueprint_explicit' },
        { id: 'blueprint_scope', name: 'Project' }
      )
    ).toEqual({
      name: 'Explicit Resource',
      blueprintId: 'blueprint_explicit',
    })
  })

  it('leaves data unchanged without an active scope', () => {
    const data = { name: 'Unscoped Resource' }

    expect(scopeCreateData(data, null)).toBe(data)
  })
})
