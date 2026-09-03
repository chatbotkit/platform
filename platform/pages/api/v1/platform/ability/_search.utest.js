import { getExternalHostURL } from '@/lib/host'

import handler from './search'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const mockSchema = {
    object: jest.fn((fields) => ({
      ...fields,
      validate: jest.fn((value) => ({ error: undefined, value })),
    })),
    string: jest.fn(() => mockSchema),
    number: jest.fn(() => ({
      integer: () => ({
        min: () => ({
          max: () => ({
            default: () => mockSchema,
          }),
        }),
      }),
    })),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
}))

jest.mock('@/data/abilities/visible', () => ({
  __esModule: true,
  default: {
    'ability-calendar': {
      name: 'Google Calendar Ability',
      description: 'Schedule and manage events',
      instruction: 'Use this ability to schedule calendar events',
      provider: 'google',
      icon: 'calendar',
      tags: ['calendar', 'schedule'],
      setup: 'connect google account',
      commentary: 'use for meeting automation',
    },
    'ability-search': {
      name: 'Web Search Ability',
      description: 'Search web for information',
      instruction: 'Use this ability to search the web',
      provider: 'cbk',
      icon: 'search',
      tags: ['search', 'web'],
      setup: 'no setup needed',
      commentary: 'use for retrieval',
    },
  },
}))

// @note links are composed by the route via getExternalHostURL - derive
// the expected origin the same way
const base = getExternalHostURL('/').replace(/\/$/, '')

describe('/api/v1/platform/ability/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty results for blank search', async () => {
    const result = await handler({}, {}, { search: '   ' })

    expect(result.status).toBe(200)
    expect(result.body.items).toEqual([])
  })

  it('returns ranked ability matches with score and excerpt', async () => {
    const result = await handler(
      {},
      {},
      { search: 'calendar scheduling', take: 2 }
    )

    expect(result.status).toBe(200)
    expect(result.body.items).toHaveLength(1)

    expect(result.body.items[0]).toMatchObject({
      id: 'ability-calendar',
      name: 'Google Calendar Ability',
      provider: 'google',
      score: expect.any(Number),
      excerpt: 'Google Calendar Ability',
      link: `${base}/abilities/ability-calendar`,
    })
  })
})
