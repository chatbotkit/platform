/**
 * @jest-environment node
 */
import handler from './list'

jest.mock('@/lib/magic', () => ({
  promptIdToAliasMap: {
    promptA: '/alpha',
    promptC: '/charlie',
  },
  prompts: {
    promptA: { description: 'Alpha description' },
    promptB: { description: 'Bravo description' },
    promptC: { description: 'Charlie description' },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => fn,
}))

describe('GET /api/v1/magic/list', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty items when cursor is provided', async () => {
    const result = await handler('next-cursor')

    expect(result).toEqual({ items: [] })
  })

  it('returns only prompts that have alias mapping', async () => {
    const result = await handler()

    expect(result.items).toHaveLength(2)
    expect(result.items.map((item) => item.id)).toEqual(['promptA', 'promptC'])
  })

  it('maps alias and name from alias map without leading slash', async () => {
    const result = await handler()

    expect(result.items[0]).toMatchObject({
      id: 'promptA',
      name: 'alpha',
      alias: 'alpha',
      description: 'Alpha description',
    })
  })

  it('sets timestamps as numbers for each item', async () => {
    const result = await handler()

    for (const item of result.items) {
      expect(typeof item.createdAt).toBe('number')
      expect(typeof item.updatedAt).toBe('number')
    }
  })
})
