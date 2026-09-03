/* eslint-disable @typescript-eslint/no-require-imports */
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

jest.mock('@/data/abilities/visible', () => {
  // A non-example ability with a required placeholder field
  const instruction = '```search/query=((query! ys|the search query))\n```'

  return {
    __esModule: true,
    default: {
      'web/search': {
        name: 'Web Search',
        description: 'Search the web for information',
        instruction,
        provider: 'cbk',
        icon: 'search',
        tags: ['search', 'web'],
        setup: 'no setup required',
        commentary: 'use for retrieval tasks',
      },
      'example/hello': {
        name: 'Hello World Example',
        description: 'A simple example ability',
        instruction: 'Just say hello to the user.',
        provider: 'cbk',
        icon: 'hand',
        tags: ['example'],
      },
      'example-greeting': {
        name: 'Greeting Example',
        description: 'Greet by name',
        instruction: 'Greet the user by name: ((name ys|user name)).',
        provider: 'cbk',
        icon: 'smile',
        tags: ['demo'],
      },
    },
  }
})

describe('/api/v1/platform/ability/list', () => {
  it('returns empty items when cursor is provided', async () => {
    const result = await handler({ query: { cursor: 'some-cursor' } })

    expect(result).toEqual({ items: [] })
  })

  it('returns all abilities when no cursor is provided', async () => {
    const result = await handler({ query: {} })

    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items).toHaveLength(3)
  })

  it('maps template key to kebab-case id', async () => {
    const result = await handler({ query: {} })

    const searchAbility = result.items.find(
      (item) => item.template === 'web/search'
    )

    expect(searchAbility).toBeDefined()
    expect(searchAbility.id).toBe('web-search')
  })

  it('preserves all ability metadata fields', async () => {
    const result = await handler({ query: {} })

    const searchAbility = result.items.find(
      (item) => item.template === 'web/search'
    )

    expect(searchAbility).toMatchObject({
      id: 'web-search',
      template: 'web/search',
      name: 'Web Search',
      description: 'Search the web for information',
      provider: 'cbk',
      icon: 'search',
      tags: ['search', 'web'],
      setup: 'no setup required',
      commentary: 'use for retrieval tasks',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
  })

  it('builds schema from placeholder fields for non-example abilities', async () => {
    const result = await handler({ query: {} })

    const searchAbility = result.items.find(
      (item) => item.template === 'web/search'
    )

    expect(searchAbility.schema).toMatchObject({
      type: 'object',
      properties: {
        query: {
          description: 'the search query',
        },
      },
      required: ['query'],
    })
  })

  it('produces empty schema properties when there are no placeholder fields', async () => {
    const result = await handler({ query: {} })

    const exampleAbility = result.items.find(
      (item) => item.template === 'example/hello'
    )

    expect(exampleAbility.schema.properties).toEqual({})
    expect(exampleAbility.schema.required).toEqual([])
  })

  it('returns raw instruction for abilities with "example" in tags', async () => {
    const result = await handler({ query: {} })

    const exampleAbility = result.items.find(
      (item) => item.template === 'example/hello'
    )

    expect(exampleAbility.instruction).toBe('Just say hello to the user.')
  })

  it('returns raw instruction for abilities whose template key starts with "example"', async () => {
    const result = await handler({ query: {} })

    const greetingAbility = result.items.find(
      (item) => item.template === 'example-greeting'
    )

    expect(greetingAbility.instruction).toBe(
      'Greet the user by name: ((name ys|user name)).'
    )
  })

  it('converts non-example ability instruction to callable template format', async () => {
    const result = await handler({ query: {} })

    const searchAbility = result.items.find(
      (item) => item.template === 'web/search'
    )

    // The converted instruction is YAML referencing the template id
    expect(searchAbility.instruction).toContain('web/search')
    expect(typeof searchAbility.instruction).toBe('string')
    // Should not be the raw instruction
    expect(searchAbility.instruction).not.toBe(
      '```search/query=((query! ys|the search query))\n```'
    )
  })
})
