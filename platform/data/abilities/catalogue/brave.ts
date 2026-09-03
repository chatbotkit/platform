import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Brave Search abilities.
 */
const abilities = {
  'brave/web/search': createFetchTemplate({
    provider: 'brave',
    icon: '@logo/brave.com',
    name: 'Web Search',
    description: 'Search the web using Brave Search',
    tags: ['brave', 'search'],
    secret: '@brave/search',
    instruction: {
      method: 'GET',
      url: 'https://api.search.brave.com/res/v1/web/search',
      query: {
        q: field({ name: 'q', description: 'Search query' }),
      },
      headers: {
        'X-Subscription-Token': secret(),
        Accept: 'application/json',
      },
    },
  }),

  'brave/api/call': createFetchTemplate({
    provider: 'brave',
    icon: '@logo/brave.com',
    name: 'Call Brave API',
    description:
      'Make a generic API call to Brave. This is a flexible template that can be used to call any Brave API endpoint by specifying the method, URL, and request body.',
    tags: ['brave', 'web', 'search', 'api', 'call', 'generic'],
    secret: '@brave/search',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Brave API endpoint to call',
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
