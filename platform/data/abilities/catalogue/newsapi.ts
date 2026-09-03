import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'newsapi/get': createFetchTemplate({
    provider: 'newsapi',
    icon: '@logo/newsapi.org',
    name: 'Get News Articles with NewsAPI',
    description: 'Fetch latest news articles based on keywords or categories',
    tags: ['news', 'newsapi'],
    secret: '@newsapi',
    instruction: {
      method: 'GET',
      url: 'https://newsapi.org/v2/everything',
      query: {
        q: field({
          name: 'query',
          description: 'search query',
        }),
        apiKey: secret(),
      },
    },
  }),

  'newsapi/api/call': createFetchTemplate({
    provider: 'newsapi',
    icon: '@logo/newsapi.org',
    name: 'Call Newsapi API',
    description:
      'Make a generic API call to Newsapi. This is a flexible template that can be used to call any Newsapi API endpoint by specifying the method, URL, and request body.',
    tags: ['newsapi', 'get', 'api', 'call', 'generic'],
    secret: '@newsapi',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Newsapi API endpoint to call',
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
