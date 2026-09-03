import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import { executeTemplate, setupServer } from '@/jest/utils/ability'

import templates from './polymarket'

import { HttpResponse, http } from 'msw'

jest.mock('@/lib/usage.record', () => ({
  recordFetchUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => {
  const originalModule = jest.requireActual('@/lib/limit.core')

  return {
    ...originalModule,

    accountLimitsOk: jest.fn(),
  }
})

jest.mock('@/lib/extract.data', () => ({
  extractDataFromInput: jest.fn(),
}))

jest.retryTimes(3)

const MARKET_ID = '540816'
const EVENT_ID = '2890'
const MARKET_SLUG = 'russia-ukraine-ceasefire-before-gta-vi-554'
const TOKEN_ID =
  '8501497159083948713316135768103773293754490207922884688769443031624417212426'
const USER = '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
const CONDITION_ID =
  '0xe254cbae8b3fa9c65f7c3290d028f8396400adc8b0a326e29d4c55aeabae5f5c'

const marketResponse = {
  id: MARKET_ID,
  question: 'Russia-Ukraine Ceasefire before GTA VI?',
  slug: MARKET_SLUG,
  conditionId: CONDITION_ID,
  clobTokenIds: JSON.stringify([TOKEN_ID]),
  active: true,
  closed: false,
  volume24hr: 12345,
}

const eventResponse = {
  id: EVENT_ID,
  slug: 'nba-will-the-mavericks-beat-the-grizzlies-by-more-than-5pt5-points',
  title: 'NBA event',
  active: true,
  closed: false,
  markets: [marketResponse],
}

const searchResponse = {
  events: [eventResponse],
  tags: [{ id: '1', label: 'Politics', slug: 'politics', event_count: 12 }],
  profiles: [
    {
      id: '1',
      name: 'Trader',
      user: 123,
      proxyWallet: USER,
    },
  ],
  pagination: {
    hasMore: false,
    totalResults: 3,
  },
}

const tradeResponse = {
  proxyWallet: USER,
  side: 'BUY',
  asset: TOKEN_ID,
  conditionId: CONDITION_ID,
  size: 42,
  price: 0.53,
  timestamp: 1775476101,
  title: marketResponse.question,
  slug: MARKET_SLUG,
  icon: 'https://polymarket.com/icon.png',
  eventSlug: eventResponse.slug,
  outcome: 'Yes',
  outcomeIndex: 0,
  transactionHash:
    '0xffddb73b435df4d30b2629552ee19f806321a14aa3976ababb8caf096681a124',
}

const activityResponse = {
  ...tradeResponse,
  type: 'TRADE',
  usdcSize: 22.26,
}

const positionResponse = {
  proxyWallet: USER,
  asset: TOKEN_ID,
  conditionId: CONDITION_ID,
  size: 100,
  avgPrice: 0.44,
  initialValue: 44,
  currentValue: 53,
  cashPnl: 9,
  percentPnl: 20.45,
  totalBought: 100,
  realizedPnl: 0,
  percentRealizedPnl: 0,
  curPrice: 0.53,
  redeemable: false,
  mergeable: false,
  title: marketResponse.question,
  slug: MARKET_SLUG,
  icon: 'https://polymarket.com/icon.png',
  eventSlug: eventResponse.slug,
  outcome: 'Yes',
  outcomeIndex: 0,
  oppositeOutcome: 'No',
  oppositeAsset: '123',
  endDate: '2026-12-31T00:00:00Z',
  negativeRisk: false,
}

const orderBookResponse = {
  market: CONDITION_ID,
  asset_id: TOKEN_ID,
  timestamp: '1775475903236',
  hash: '4382b5f96bfc11fd83bc27f838505c734181c9e5',
  bids: [{ price: '0.53', size: '100' }],
  asks: [{ price: '0.54', size: '125' }],
  min_order_size: '1',
  tick_size: '0.01',
  neg_risk: false,
  last_trade_price: '0.53',
}

const handlers = [
  http.get(
    'https://gamma-api.polymarket.com/invalid-endpoint-that-does-not-exist',
    () => {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
  ),

  http.get('https://gamma-api.polymarket.com/markets', () => {
    return HttpResponse.json([marketResponse])
  }),

  http.get('https://gamma-api.polymarket.com/markets/:id', ({ params }) => {
    return HttpResponse.json({
      ...marketResponse,
      id: String(params.id),
    })
  }),

  http.get(
    'https://gamma-api.polymarket.com/markets/slug/:slug',
    ({ params }) => {
      return HttpResponse.json({
        ...marketResponse,
        slug: String(params.slug),
      })
    }
  ),

  http.get('https://gamma-api.polymarket.com/events', () => {
    return HttpResponse.json([eventResponse])
  }),

  http.get('https://gamma-api.polymarket.com/events/:id', ({ params }) => {
    return HttpResponse.json({
      ...eventResponse,
      id: String(params.id),
    })
  }),

  http.get('https://gamma-api.polymarket.com/public-search', () => {
    return HttpResponse.json(searchResponse)
  }),

  http.get('https://data-api.polymarket.com/trades', () => {
    return HttpResponse.json([tradeResponse])
  }),

  http.get('https://data-api.polymarket.com/activity', () => {
    return HttpResponse.json([activityResponse])
  }),

  http.get('https://data-api.polymarket.com/positions', () => {
    return HttpResponse.json([positionResponse])
  }),

  http.get('https://clob.polymarket.com/book', () => {
    return HttpResponse.json(orderBookResponse)
  }),

  http.get('https://clob.polymarket.com/midpoint', () => {
    return HttpResponse.json({ mid: '0.535' })
  }),

  http.get('https://clob.polymarket.com/prices-history', () => {
    return HttpResponse.json({
      history: [
        { t: 1746230406, p: 0.71 },
        { t: 1746316805, p: 0.69 },
      ],
    })
  }),
]

const server = setupServer(...handlers)

beforeAll(async () => {
  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=1&offset=0'
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://gamma-api.polymarket.com/invalid-endpoint-that-does-not-exist'
    )

    expect(response.status).not.toBe(200)
  })
})

describe('templates', () => {
  const user = {
    id: 'user-123',
  }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const untestableTemplates = ['polymarket/api/call']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        if (input.id) {
          input.id = MARKET_ID
        }

        if (template === 'polymarket/event/fetch[by-id]') {
          input.id = EVENT_ID
        }

        if (input.slug) {
          input.slug = MARKET_SLUG
        }

        if (input.user) {
          input.user = USER
        }

        if (input.tokenId) {
          input.tokenId = TOKEN_ID
        }

        if (input.market) {
          input.market = TOKEN_ID
        }

        if (input.query) {
          input.query = 'trump'
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
