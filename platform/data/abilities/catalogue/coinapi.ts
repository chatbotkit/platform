import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of CoinAPI abilities.
 */
const abilities = {
  'coinapi/info': createFetchTemplate({
    provider: 'coinapi',
    icon: '@logo/coinapi.io',
    name: 'Get Cryptocurrency Information with CoinAPI',
    description:
      'Fetch cryptocurrency data such as price, market cap, and volume',
    tags: ['cryptocurrency', 'coinapi'],
    secret: '@coinapi',
    instruction: {
      method: 'GET',
      url: 'https://rest.coinapi.io',
      path: [
        '/v1/assets/',
        field({ name: 'crypto', description: 'cryptocurrency symbol' }),
      ],
      query: {
        apikey: secret(),
      },
    },
  }),

  'coinapi/api/call': createFetchTemplate({
    provider: 'coinapi',
    icon: '@logo/coinapi.io',
    name: 'Call Coinapi API',
    description:
      'Make a generic API call to Coinapi. This is a flexible template that can be used to call any Coinapi API endpoint by specifying the method, URL, and request body.',
    tags: ['coinapi', 'info', 'api', 'call', 'generic'],
    secret: '@coinapi',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Coinapi API endpoint to call',
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
