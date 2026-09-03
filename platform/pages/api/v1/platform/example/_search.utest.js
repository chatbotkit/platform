/**
 * @jest-environment node
 */
import { searchExamples } from '@/lib/example.search'

import handler from './search'

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/example.search', () => ({
  searchExamples: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/examples', () => [
  {
    slug: 'blueprint-example',
    title: 'Blueprint Example',
    description: 'Blueprint based example',
    blueprint: {},
    keywords: ['blueprint'],
    date: '2026-01-01',
  },
  {
    slug: 'project-example',
    title: 'Project Example',
    description: 'Project style example',
    files: ['index.js'],
    keywords: ['project'],
    date: '2026-01-02',
  },
  {
    slug: 'integration-example',
    title: 'Integration Example',
    description: 'Slack integration example',
    integration: 'slack',
    keywords: ['slack'],
  },
  {
    slug: 'widget-example',
    title: 'Widget Example',
    description: 'Widget fallback example',
    keywords: ['widget'],
  },
])

describe('/api/v1/platform/example/search', () => {
  const req = {}
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('searches with expected limit and maps typed results', async () => {
    searchExamples.mockResolvedValue([
      { slug: 'blueprint-example' },
      { slug: 'project-example' },
      { slug: 'integration-example' },
      { slug: 'widget-example' },
    ])

    const response = await handler(req, session, {
      search: 'examples',
      take: 4,
    })

    expect(searchExamples).toHaveBeenCalledWith('examples', {
      limit: 4,
      threshold: 0,
    })
    expect(response.status).toBe(200)
    expect(response.body.items.map((item) => item.type)).toEqual([
      'blueprint',
      'project',
      'slack',
      'widget',
    ])
  })

  it('filters out stale search results not present in examples data', async () => {
    searchExamples.mockResolvedValue([
      { slug: 'blueprint-example' },
      { slug: 'missing-example' },
    ])

    const response = await handler(req, session, { search: 'x', take: 10 })

    expect(response.body.items).toHaveLength(1)
    expect(response.body.items[0].id).toBe('blueprint-example')
  })

  it('uses default take and fallback timestamps when date is missing', async () => {
    const before = Date.now()

    searchExamples.mockResolvedValue([{ slug: 'widget-example' }])

    const response = await handler(req, session, { search: 'widget' })

    const after = Date.now()

    expect(searchExamples).toHaveBeenCalledWith('widget', {
      limit: 10,
      threshold: 0,
    })
    expect(response.body.items[0].createdAt).toBeGreaterThanOrEqual(before)
    expect(response.body.items[0].createdAt).toBeLessThanOrEqual(after)
  })
})
