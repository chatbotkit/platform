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

jest.mock('@/data/secrets/visible', () => ({
  __esModule: true,
  default: {
    'google/calendar': {
      name: 'Google Calendar',
      description: 'Connect to Google Calendar to manage events',
      type: 'oauth',
      kind: 'personal',
      config: {},
      icon: '@logo/google.com',
      tags: ['calendar', 'google'],
      setup: 'Create oauth app',
      commentary: 'Useful for scheduling workflows',
    },
    bearer: {
      name: 'HTTP API Token',
      description: 'A bearer token for making authenticated requests',
      type: 'bearer',
      config: {},
      icon: '@logo/chatbotkit.com',
      tags: ['api', 'token'],
      setup: 'Provide your token',
      commentary: 'Works for generic APIs',
    },
  },
}))

// @note links are composed by the route via getExternalHostURL - derive
// the expected origin the same way
const base = getExternalHostURL('/').replace(/\/$/, '')

describe('/api/v1/platform/secret/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty results for blank search', async () => {
    const result = await handler({}, {}, { search: '   ' })

    expect(result.status).toBe(200)
    expect(result.body.items).toEqual([])
  })

  it('returns ranked secret matches with score and excerpt', async () => {
    const result = await handler(
      {},
      {},
      { search: 'google oauth calendar', take: 2 }
    )

    expect(result.status).toBe(200)
    expect(result.body.items).toHaveLength(1)

    expect(result.body.items[0]).toMatchObject({
      id: 'google-calendar',
      template: 'google/calendar',
      name: 'Google Calendar',
      type: 'oauth',
      score: expect.any(Number),
      excerpt: 'Google Calendar',
      link: `${base}/secrets/google/calendar`,
    })
  })
})
