/* eslint-disable @typescript-eslint/no-require-imports */
import handlers, {
  API_CALL_HANDLER_NAME,
  CUSTOMER_LIST_HANDLER_NAME,
  KEYWORD_FORECAST_METRICS_HANDLER_NAME,
  KEYWORD_HISTORICAL_METRICS_HANDLER_NAME,
  KEYWORD_IDEAS_HANDLER_NAME,
  apiCallSchema,
  customerListSchema,
  keywordForecastMetricsSchema,
  keywordHistoricalMetricsSchema,
  keywordIdeasSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/ads'

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlersMap) => {
    const result = {}

    for (const [name, handler] of Object.entries(handlersMap)) {
      // @note every auxiliary route is authenticated; bind a mock session so
      // the tests keep calling the inner function as (parameters, headers)
      result[name] = (parameters, headers) =>
        handler.fn({ user: { id: 'test-user-id' } }, parameters, headers)
    }

    return result
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`Google Ads API error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

const mockCall = require('@/lib/call').default

describe('Google Ads handlers', () => {
  const originalEnv = process.env
  const headers = new Headers({
    'x-access-token': 'Bearer oauth-token',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.SERVICE_GOOGLE_ADS_API_VERSION
    delete process.env._GOOGLE_ADS_API_VERSION

    mockCall.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('registers every handler', () => {
    expect(handlers).toHaveProperty(CUSTOMER_LIST_HANDLER_NAME)
    expect(handlers).toHaveProperty(KEYWORD_IDEAS_HANDLER_NAME)
    expect(handlers).toHaveProperty(KEYWORD_HISTORICAL_METRICS_HANDLER_NAME)
    expect(handlers).toHaveProperty(KEYWORD_FORECAST_METRICS_HANDLER_NAME)
    expect(handlers).toHaveProperty(API_CALL_HANDLER_NAME)
  })

  describe('schemas', () => {
    it('accepts keyword, URL, and site seeds', () => {
      expect(
        keywordIdeasSchema.safeParse({
          customerId: '123-456-7890',
          keywords: ['chatbot'],
        }).success
      ).toBe(true)
      expect(
        keywordIdeasSchema.safeParse({
          customerId: '1234567890',
          url: 'https://example.com/page',
        }).success
      ).toBe(true)
      expect(
        keywordIdeasSchema.safeParse({
          customerId: '1234567890',
          siteUrl: 'https://example.com',
        }).success
      ).toBe(true)
    })

    it('rejects missing or conflicting keyword idea seeds', () => {
      expect(
        keywordIdeasSchema.safeParse({
          customerId: '1234567890',
        }).success
      ).toBe(false)
      expect(
        keywordIdeasSchema.safeParse({
          customerId: '1234567890',
          keywords: ['chatbot'],
          siteUrl: 'https://example.com',
        }).success
      ).toBe(false)
    })

    it('rejects invalid customer IDs and unsafe raw paths', () => {
      expect(
        customerListSchema.safeParse({
          loginCustomerId: '123',
        }).success
      ).toBe(false)
      expect(
        apiCallSchema.safeParse({
          path: 'https://example.com/steal-token',
        }).success
      ).toBe(false)
      expect(
        apiCallSchema.safeParse({
          path: '//example.com/steal-token',
        }).success
      ).toBe(false)
    })

    it('coerces JSON strings used by agent-generated parameters', () => {
      const historical = keywordHistoricalMetricsSchema.parse({
        customerId: '1234567890',
        keywords: '["chatbot","ai agent"]',
      })
      const raw = apiCallSchema.parse({
        path: 'customers:listAccessibleCustomers',
        query: '{"pageSize":10}',
        data: '{"query":"SELECT campaign.id FROM campaign"}',
      })

      expect(historical.keywords).toEqual(['chatbot', 'ai agent'])
      expect(raw.query).toEqual({ pageSize: 10 })
      expect(raw.data).toEqual({
        query: 'SELECT campaign.id FROM campaign',
      })
    })

    it('requires both forecast dates when either is supplied', () => {
      expect(
        keywordForecastMetricsSchema.safeParse({
          customerId: '1234567890',
          keywords: ['chatbot'],
          maxCpcBidMicros: 1000000,
          startDate: '2026-08-01',
        }).success
      ).toBe(false)
    })
  })

  it('lists accessible customers through the Pipedream Google Ads proxy', async () => {
    await handlers[CUSTOMER_LIST_HANDLER_NAME](
      customerListSchema.parse({
        loginCustomerId: '111-222-3333',
      }),
      headers
    )

    expect(mockCall).toHaveBeenCalledWith('https://googleads.m.pipedream.net', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        headers: {
          Authorization: 'Bearer oauth-token',
          'login-customer-id': '1112223333',
        },
        path: '/v25/customers:listAccessibleCustomers',
        method: 'GET',
      }),
    })
  })

  it('generates keyword ideas from combined keyword and URL seeds', async () => {
    await handlers[KEYWORD_IDEAS_HANDLER_NAME](
      keywordIdeasSchema.parse({
        customerId: '123-456-7890',
        loginCustomerId: '111-222-3333',
        keywords: ['chatbot'],
        url: 'https://example.com/chatbots',
      }),
      headers
    )

    const [url, options] = mockCall.mock.calls[0]
    const proxyRequest = JSON.parse(options.body)
    const body = proxyRequest.data

    expect(url).toBe('https://googleads.m.pipedream.net')
    expect(proxyRequest.path).toBe(
      '/v25/customers/1234567890:generateKeywordIdeas'
    )
    expect(proxyRequest.method).toBe('POST')
    expect(proxyRequest.headers['login-customer-id']).toBe('1112223333')
    expect(body).toEqual({
      keywordAndUrlSeed: {
        keywords: ['chatbot'],
        url: 'https://example.com/chatbots',
      },
      geoTargetConstants: ['geoTargetConstants/2840'],
      language: 'languageConstants/1000',
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      includeAdultKeywords: false,
      pageSize: 1000,
    })
  })

  it('generates historical metrics with CPC enabled', async () => {
    await handlers[KEYWORD_HISTORICAL_METRICS_HANDLER_NAME](
      keywordHistoricalMetricsSchema.parse({
        customerId: '1234567890',
        keywords: ['chatbot', 'ai agent'],
      }),
      headers
    )

    const body = JSON.parse(mockCall.mock.calls[0][1].body).data

    expect(body).toEqual({
      keywords: ['chatbot', 'ai agent'],
      geoTargetConstants: ['geoTargetConstants/2840'],
      language: 'languageConstants/1000',
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      includeAdultKeywords: false,
      historicalMetricsOptions: {
        includeAverageCpc: true,
      },
    })
  })

  it('builds a v25 keyword forecast campaign', async () => {
    await handlers[KEYWORD_FORECAST_METRICS_HANDLER_NAME](
      keywordForecastMetricsSchema.parse({
        customerId: '1234567890',
        keywords: ['chatbot', 'ai agent'],
        matchType: 'PHRASE',
        maxCpcBidMicros: 1500000,
        dailyBudgetMicros: 10000000,
        currencyCode: 'USD',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
      headers
    )

    const [url, options] = mockCall.mock.calls[0]
    const proxyRequest = JSON.parse(options.body)
    const body = proxyRequest.data

    expect(url).toBe('https://googleads.m.pipedream.net')
    expect(proxyRequest.path).toBe(
      '/v25/customers/1234567890:generateKeywordForecastMetrics'
    )
    expect(body).toEqual({
      campaign: {
        biddingStrategy: {
          manualCpcBiddingStrategy: {
            maxCpcBidMicros: 1500000,
            dailyBudgetMicros: 10000000,
          },
        },
        geoTargetConstants: ['geoTargetConstants/2840'],
        languageConstants: ['languageConstants/1000'],
        adGroups: [
          {
            keywords: [
              { text: 'chatbot', matchType: 'PHRASE' },
              { text: 'ai agent', matchType: 'PHRASE' },
            ],
          },
        ],
      },
      currencyCode: 'USD',
      forecastPeriod: {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      },
    })
  })

  it('makes a raw request while keeping the upstream host fixed', async () => {
    process.env.SERVICE_GOOGLE_ADS_API_VERSION = 'v23'

    await handlers[API_CALL_HANDLER_NAME](
      apiCallSchema.parse({
        path: '/customers/1234567890/googleAds:search',
        loginCustomerId: '1112223333',
        method: 'POST',
        query: { pageSize: 50 },
        data: {
          query: 'SELECT campaign.id FROM campaign',
        },
      }),
      headers
    )

    expect(mockCall).toHaveBeenCalledWith('https://googleads.m.pipedream.net', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        headers: {
          Authorization: 'Bearer oauth-token',
          'login-customer-id': '1112223333',
        },
        path: '/v23/customers/1234567890/googleAds:search',
        method: 'POST',
        params: {
          pageSize: 50,
        },
        data: {
          query: 'SELECT campaign.id FROM campaign',
        },
      }),
    })
  })

  it('rejects a missing OAuth token', async () => {
    await expect(
      handlers[CUSTOMER_LIST_HANDLER_NAME](
        customerListSchema.parse({}),
        new Headers()
      )
    ).rejects.toThrow('Not authenticated')
  })

  it('rejects an invalid configured API version', async () => {
    process.env.SERVICE_GOOGLE_ADS_API_VERSION = 'latest'

    await expect(
      handlers[CUSTOMER_LIST_HANDLER_NAME](
        customerListSchema.parse({}),
        headers
      )
    ).rejects.toThrow('Google Ads API version must have the form v<number>')
  })

  it('surfaces upstream Google Ads errors', async () => {
    mockCall.mockResolvedValue({
      ok: false,
      status: 400,
    })

    await expect(
      handlers[CUSTOMER_LIST_HANDLER_NAME](
        customerListSchema.parse({}),
        headers
      )
    ).rejects.toThrow('Google Ads API error: 400')
  })
})
