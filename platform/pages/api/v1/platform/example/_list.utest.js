import handler from './list'

import { getExternalHostURL } from '@/lib/host'

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

// @note we inject controlled examples to test the type detection logic precisely
jest.mock('@/examples', () => ({
  __esModule: true,
  default: [
    {
      slug: 'blueprint-example',
      title: 'Blueprint Bot',
      description: 'A bot configured from a blueprint',
      blueprint: { id: 'bp-001' },
      keywords: ['ai', 'blueprint'],
      date: '2024-01-15',
    },
    {
      slug: 'project-example',
      title: 'SDK Project',
      description: 'A full SDK project',
      files: ['src/index.js', 'package.json'],
      keywords: ['sdk', 'project'],
      date: '2024-02-20',
    },
    {
      slug: 'integration-example',
      title: 'Slack Integration',
      description: 'Connect your bot to Slack',
      integration: 'slack',
      keywords: ['slack', 'messaging'],
    },
    {
      slug: 'widget-example',
      title: 'Widget Embed',
      description: 'Embed a chat widget',
      keywords: ['widget', 'embed'],
    },
  ],
}))

// @note links are composed by the route via getExternalHostURL - derive
// the expected origin the same way
const base = getExternalHostURL('/').replace(/\/$/, '')

describe('/api/v1/platform/example/list', () => {
  it('returns empty items when cursor is provided', async () => {
    const response = await handler({ query: { cursor: 'some-cursor' } })

    expect(response).toEqual({ items: [] })
  })

  it('returns all examples when no cursor is provided', async () => {
    const response = await handler({ query: {} })

    expect(Array.isArray(response.items)).toBe(true)
    expect(response.items).toHaveLength(4)
  })

  it('sets type to blueprint when example has a blueprint property', async () => {
    const response = await handler({ query: {} })

    const item = response.items.find((i) => i.id === 'blueprint-example')

    expect(item.type).toBe('blueprint')
  })

  it('sets type to project when example has a files array', async () => {
    const response = await handler({ query: {} })

    const item = response.items.find((i) => i.id === 'project-example')

    expect(item.type).toBe('project')
  })

  it('sets type to integration value when example has an integration field', async () => {
    const response = await handler({ query: {} })

    const item = response.items.find((i) => i.id === 'integration-example')

    expect(item.type).toBe('slack')
  })

  it('falls back to widget type when no blueprint, files, or integration field', async () => {
    const response = await handler({ query: {} })

    const item = response.items.find((i) => i.id === 'widget-example')

    expect(item.type).toBe('widget')
  })

  it('maps title, description, keywords, slug to standard item fields', async () => {
    const response = await handler({ query: {} })

    const item = response.items.find((i) => i.id === 'blueprint-example')

    expect(item).toMatchObject({
      id: 'blueprint-example',
      name: 'Blueprint Bot',
      description: 'A bot configured from a blueprint',
      tags: ['ai', 'blueprint'],
      link: `${base}/examples/blueprint-example`,
    })
  })

  it('uses date for timestamps when available', async () => {
    const response = await handler({ query: {} })

    const item = response.items.find((i) => i.id === 'blueprint-example')
    const expected = new Date('2024-01-15').getTime()

    expect(item.createdAt).toBe(expected)
    expect(item.updatedAt).toBe(expected)
  })

  it('falls back to Date.now() when date is missing', async () => {
    const before = Date.now()
    const response = await handler({ query: {} })
    const after = Date.now()

    const item = response.items.find((i) => i.id === 'widget-example')

    expect(item.createdAt).toBeGreaterThanOrEqual(before)
    expect(item.createdAt).toBeLessThanOrEqual(after)
  })

  it('includes a site link for every item', async () => {
    const response = await handler({ query: {} })

    for (const item of response.items) {
      expect(item.link).toBe(
        `${base}/examples/${item.id}`
      )
    }
  })

  it('blueprint type takes precedence over files when both are present', async () => {
    // This test exercises the if-else ordering: blueprint check happens first
    // A theoretical entry with BOTH blueprint and files should resolve as blueprint
    jest.resetModules()

    const mockExamples = jest.fn(() => ({
      __esModule: true,
      default: [
        {
          slug: 'both',
          title: 'Both',
          description: 'Has both',
          blueprint: { id: 'x' },
          files: ['a.js'],
          keywords: [],
        },
      ],
    }))

    jest.doMock('@/examples', mockExamples)

    // Re-import after remocking
    const freshHandler = (await import('./list')).default

    const response = await freshHandler({ query: {} })
    const item = response.items.find((i) => i.id === 'both')

    expect(item.type).toBe('blueprint')

    jest.resetModules()
  })
})
