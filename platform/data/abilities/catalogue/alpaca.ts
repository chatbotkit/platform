import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'alpaca/api/call': createFetchTemplate({
    provider: 'alpaca',
    icon: '@logo/alpaca.markets',
    name: 'Call Alpaca API (Live)',
    description:
      'Make a generic API call to the Alpaca live trading environment by specifying the method, URL, and request body. This places REAL orders against a funded brokerage account and moves real money. Use the live base URL https://api.alpaca.markets (e.g. https://api.alpaca.markets/v2/orders). Market data endpoints use https://data.alpaca.markets.',
    tags: [
      'alpaca',
      'trading',
      'stocks',
      'crypto',
      'live',
      'api',
      'call',
      'generic',
    ],
    secret: '@alpaca',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description:
          'The full URL of the Alpaca API endpoint to call. For live trading use the https://api.alpaca.markets base, e.g. https://api.alpaca.markets/v2/orders. Market data endpoints use https://data.alpaca.markets.',
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

  'alpaca/api/call[paper]': createFetchTemplate({
    provider: 'alpaca',
    icon: '@logo/alpaca.markets',
    name: 'Call Alpaca API (Paper)',
    description:
      'Make a generic API call to the Alpaca paper trading environment by specifying the method, URL, and request body. Use the paper base URL https://paper-api.alpaca.markets (e.g. https://paper-api.alpaca.markets/v2/account or /v2/orders). Market data endpoints use https://data.alpaca.markets.',
    tags: [
      'alpaca',
      'trading',
      'stocks',
      'crypto',
      'paper',
      'api',
      'call',
      'generic',
    ],
    secret: '@alpaca[paper]',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description:
          'The full URL of the Alpaca API endpoint to call. For paper trading use the https://paper-api.alpaca.markets base, e.g. https://paper-api.alpaca.markets/v2/orders. Market data endpoints use https://data.alpaca.markets.',
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
