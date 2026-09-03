import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'unsplash/photo/search': createFetchTemplate({
    provider: 'unsplash',
    icon: '@logo/unsplash.com',
    name: 'Search Photos',
    description:
      'Search for high-quality, free-to-use photos on Unsplash by query terms',
    tags: ['unsplash', 'photos', 'images', 'search'],
    secret: '@platform/unsplash',
    instruction: {
      method: 'GET',
      url: 'https://api.unsplash.com',
      path: ['/search/photos'],
      headers: {
        'Accept-Version': 'v1',
        Authorization: secret(),
      },
      query: {
        query: field({
          name: 'query',
          description: 'search terms for finding photos',
        }),
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'page number for pagination',
        }),
        per_page: field({
          name: 'perPage',
          type: 'number',
          optional: true,
          default: 10,
          description: 'number of results per page (max 30)',
        }),
        orientation: field({
          name: 'orientation',
          optional: true,
          enum: ['landscape', 'portrait', 'squarish'],
          description: 'filter by photo orientation',
        }),
        color: field({
          name: 'color',
          optional: true,
          enum: [
            'black_and_white',
            'black',
            'white',
            'yellow',
            'orange',
            'red',
            'purple',
            'magenta',
            'green',
            'teal',
            'blue',
          ],
          description: 'filter results by color',
        }),
        content_filter: field({
          name: 'contentFilter',
          optional: true,
          enum: ['low', 'high'],
          description: 'limit results by content safety level',
        }),
      },
    },
  }),

  'unsplash/photo/get': createFetchTemplate({
    provider: 'unsplash',
    icon: '@logo/unsplash.com',
    name: 'Get Photo',
    description: 'Get detailed information about a specific photo by its ID',
    tags: ['unsplash', 'photo', 'get'],
    secret: '@platform/unsplash',
    instruction: {
      method: 'GET',
      url: 'https://api.unsplash.com',
      path: ['/photos/', field({ name: 'photoId', description: 'photo ID' })],
      headers: {
        'Accept-Version': 'v1',
        Authorization: secret(),
      },
    },
  }),

  'unsplash/photo/random': createFetchTemplate({
    provider: 'unsplash',
    icon: '@logo/unsplash.com',
    name: 'Get Random Photo',
    description:
      'Get a random photo, optionally filtered by query or collections',
    tags: ['unsplash', 'photo', 'random'],
    secret: '@platform/unsplash',
    instruction: {
      method: 'GET',
      url: 'https://api.unsplash.com',
      path: ['/photos/random'],
      headers: {
        'Accept-Version': 'v1',
        Authorization: secret(),
      },
      query: {
        query: field({
          name: 'query',
          optional: true,
          description: 'optional search terms to filter random photos',
        }),
        orientation: field({
          name: 'orientation',
          optional: true,
          enum: ['landscape', 'portrait', 'squarish'],
          description: 'filter by photo orientation',
        }),
        content_filter: field({
          name: 'contentFilter',
          optional: true,
          enum: ['low', 'high'],
          description: 'limit results by content safety level',
        }),
      },
    },
  }),

  'unsplash/collection/list': createFetchTemplate({
    provider: 'unsplash',
    icon: '@logo/unsplash.com',
    name: 'List Collections',
    description: 'Get a list of curated photo collections',
    tags: ['unsplash', 'collections', 'list'],
    secret: '@platform/unsplash',
    instruction: {
      method: 'GET',
      url: 'https://api.unsplash.com',
      path: ['/collections'],
      headers: {
        'Accept-Version': 'v1',
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'page number for pagination',
        }),
        per_page: field({
          name: 'perPage',
          type: 'number',
          optional: true,
          default: 10,
          description: 'number of results per page (max 30)',
        }),
      },
    },
  }),

  'unsplash/collection/get': createFetchTemplate({
    provider: 'unsplash',
    icon: '@logo/unsplash.com',
    name: 'Get Collection',
    description: 'Get detailed information about a specific collection',
    tags: ['unsplash', 'collection', 'get'],
    secret: '@platform/unsplash',
    instruction: {
      method: 'GET',
      url: 'https://api.unsplash.com',
      path: [
        '/collections/',
        field({ name: 'collectionId', description: 'collection ID' }),
      ],
      headers: {
        'Accept-Version': 'v1',
        Authorization: secret(),
      },
    },
  }),

  'unsplash/api/call': createFetchTemplate({
    provider: 'unsplash',
    icon: '@logo/unsplash.com',
    name: 'Call Unsplash API',
    description:
      'Make a generic API call to Unsplash. This is a flexible template that can be used to call any Unsplash API endpoint by specifying the method, URL, and request body.',
    tags: ['unsplash', 'api', 'call', 'generic'],
    secret: '@platform/unsplash',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Unsplash API endpoint to call',
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
