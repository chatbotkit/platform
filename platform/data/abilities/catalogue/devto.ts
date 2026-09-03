import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'devto/article/list': createFetchTemplate({
    provider: 'devto',
    icon: '@logo/dev.to',
    name: 'List Dev.to Articles',
    description:
      'Fetch published articles from Dev.to based on various filters',
    tags: ['devto', 'blog', 'content'],
    secret: '@devto',
    instruction: {
      method: 'GET',
      url: 'https://dev.to/api',
      path: ['/articles'],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'page number',
        }),
        per_page: field({
          name: 'perPage',
          type: 'number',
          optional: true,
          default: 30,
          description: 'number of articles per page',
        }),
        tag: field({
          name: 'tag',
          optional: true,
          description: 'filter by tag',
        }),
        username: field({
          name: 'username',
          optional: true,
          description: 'filter by author username',
        }),
      },
    },
  }),

  'devto/article/get': createFetchTemplate({
    provider: 'devto',
    icon: '@logo/dev.to',
    name: 'Get Dev.to Article',
    description: 'Fetch a specific article by ID from Dev.to',
    tags: ['devto', 'blog', 'content'],
    secret: '@devto',
    instruction: {
      method: 'GET',
      url: 'https://dev.to/api',
      path: ['/articles/', field({ name: 'id', description: 'article ID' })],
    },
  }),

  'devto/article/search': createFetchTemplate({
    provider: 'devto',
    icon: '@logo/dev.to',
    name: 'Search Dev.to Articles',
    description: 'Search for articles on Dev.to using keywords',
    tags: ['devto', 'blog', 'search'],
    secret: '@devto',
    instruction: {
      method: 'GET',
      url: 'https://dev.to/api',
      path: ['/articles'],
      query: {
        search: field({
          name: 'query',
          description: 'search query',
        }),
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'page number',
        }),
      },
    },
  }),

  'devto/user/get': createFetchTemplate({
    provider: 'devto',
    icon: '@logo/dev.to',
    name: 'Get Dev.to User',
    description: 'Fetch user profile information from Dev.to',
    tags: ['devto', 'user', 'profile'],
    secret: '@devto',
    instruction: {
      method: 'GET',
      url: 'https://dev.to/api',
      path: ['/users/', field({ name: 'username', description: 'username' })],
    },
  }),

  'devto/me/articles': createFetchTemplate({
    provider: 'devto',
    icon: '@logo/dev.to',
    name: 'Get My Published Articles',
    description: 'Fetch published articles for the authenticated user',
    tags: ['devto', 'blog', 'user'],
    secret: '@devto',
    instruction: {
      method: 'GET',
      url: 'https://dev.to/api',
      path: ['/articles/me/published'],
      headers: {
        'api-key': secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'page number',
        }),
        per_page: field({
          name: 'perPage',
          type: 'number',
          optional: true,
          default: 30,
          description: 'number of articles per page',
        }),
      },
    },
  }),

  'devto/api/call': createFetchTemplate({
    provider: 'devto',
    icon: '@logo/dev.to',
    name: 'Call Devto API',
    description:
      'Make a generic API call to Devto. This is a flexible template that can be used to call any Devto API endpoint by specifying the method, URL, and request body.',
    tags: ['devto', 'api', 'call', 'generic'],
    secret: '@devto',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Devto API endpoint to call',
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
