import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Alpha Vantage abilities.
 */
const abilities = {
  'alphavantage/stock': createFetchTemplate({
    provider: 'alphavantage',
    icon: '@logo/alphavantage.co',
    name: 'Get Stock Market Data with Alpha Vantage',
    description: 'Retrieve current stock market data for a specific symbol',
    tags: ['finance', 'stock', 'alphavantage'],
    secret: '@alphavantage',
    instruction: {
      method: 'GET',
      url: 'https://www.alphavantage.co/query',
      query: {
        function: 'GLOBAL_QUOTE',
        symbol: field({ name: 'symbol', description: 'stock symbol' }),
        apikey: secret(),
      },
    },
  }),

  'alphavantage/api/call': createFetchTemplate({
    provider: 'alphavantage',
    icon: '@logo/alphavantage.co',
    name: 'Call Alphavantage API',
    description:
      'Make a generic API call to Alphavantage. This is a flexible template that can be used to call any Alphavantage API endpoint by specifying the method, URL, and request body.',
    tags: ['alphavantage', 'stock', 'api', 'call', 'generic'],
    secret: '@alphavantage',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Alphavantage API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),
}

export default abilities
