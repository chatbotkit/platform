import allAbilities from '@/data/abilities/all'

import { definitions } from '@/lib/action.definition'
import { ActionName } from '@/lib/action.name'

import handler from './list'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor:
    (fn) =>
    async (req = {}) =>
      fn(req.query?.cursor || null),
}))

describe('/api/v1/platform/action/list', () => {
  it('returns empty items when cursor is provided', async () => {
    const response = await handler({ query: { cursor: 'next' } })

    expect(response).toEqual({ items: [] })
  })

  it('returns mapped actions with resolved ability examples', async () => {
    const response = await handler({ query: {} })

    expect(Array.isArray(response.items)).toBe(true)
    expect(response.items.length).toBeGreaterThan(0)

    const firstId = Object.values(ActionName)[0]
    const firstName = Object.keys(ActionName)[0]
    const firstDefinition = definitions[firstId]

    expect(response.items[0]).toMatchObject({
      id: firstId,
      name: firstName,
      description: firstDefinition.description,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
  })

  it('filters unresolved action examples and keeps resolved instructions', async () => {
    const response = await handler({ query: {} })
    const byId = new Map(response.items.map((item) => [item.id, item]))

    const actionWithAbilityRef = Object.values(ActionName).find((id) =>
      definitions[id].examples.some((example) => example.startsWith('@'))
    )

    if (!actionWithAbilityRef) {
      expect(response.items).toBeDefined()

      return
    }

    const expectedExamples = definitions[actionWithAbilityRef].examples
      .map((exampleRef) => {
        if (!exampleRef.startsWith('@')) {
          return null
        }

        const ability = allAbilities[exampleRef.substring(1)]

        return ability?.instruction || null
      })
      .filter(Boolean)

    expect(byId.get(actionWithAbilityRef).examples).toEqual(expectedExamples)
    expect(byId.get(actionWithAbilityRef).examples).not.toContain(null)
  })
})
