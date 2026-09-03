import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'giphy/search': createFetchTemplate({
    provider: 'giphy',
    icon: '@logo/giphy.com',
    name: 'Search GIFs',
    description:
      'Search for GIFs using keywords and filters, returning a collection of matching animated images',
    tags: ['giphy', 'gif', 'search', 'image', 'animation'],
    secret: '@giphy',
    instruction: {
      method: 'GET',
      url: 'https://api.giphy.com',
      path: ['/v1/gifs/search'],
      query: {
        api_key: secret(),
        q: field({
          name: 'query',
          description: 'Search query for finding GIFs',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 25,
          description: 'Number of results to return (max 50)',
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          optional: true,
          default: 0,
          description: 'Results offset for pagination',
        }),
        rating: field({
          name: 'rating',
          optional: true,
          enum: ['g', 'pg', 'pg-13', 'r'],
          default: 'g',
          description: 'Content rating filter (g, pg, pg-13, r)',
        }),
        lang: field({
          name: 'language',
          optional: true,
          default: 'en',
          description: 'Language code for results (e.g., en, es, fr)',
        }),
      },
    },
  }),

  'giphy/trending': createFetchTemplate({
    provider: 'giphy',
    icon: '@logo/giphy.com',
    name: 'Get Trending GIFs',
    description:
      'Fetch currently trending GIFs on Giphy, sorted by popularity and engagement',
    tags: ['giphy', 'gif', 'trending', 'popular'],
    secret: '@giphy',
    instruction: {
      method: 'GET',
      url: 'https://api.giphy.com',
      path: ['/v1/gifs/trending'],
      query: {
        api_key: secret(),
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 25,
          description: 'Number of results to return (max 50)',
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          optional: true,
          default: 0,
          description: 'Results offset for pagination',
        }),
        rating: field({
          name: 'rating',
          optional: true,
          enum: ['g', 'pg', 'pg-13', 'r'],
          default: 'g',
          description: 'Content rating filter (g, pg, pg-13, r)',
        }),
      },
    },
  }),

  'giphy/random': createFetchTemplate({
    provider: 'giphy',
    icon: '@logo/giphy.com',
    name: 'Get Random GIF',
    description:
      'Fetch a random GIF, optionally filtered by search tag for more relevant randomness',
    tags: ['giphy', 'gif', 'random'],
    secret: '@giphy',
    instruction: {
      method: 'GET',
      url: 'https://api.giphy.com',
      path: ['/v1/gifs/random'],
      query: {
        api_key: secret(),
        tag: field({
          name: 'tag',
          optional: true,
          description: 'Optional tag to filter random GIF selection',
        }),
        rating: field({
          name: 'rating',
          optional: true,
          enum: ['g', 'pg', 'pg-13', 'r'],
          default: 'g',
          description: 'Content rating filter (g, pg, pg-13, r)',
        }),
      },
    },
  }),

  'giphy/gif/fetch': createFetchTemplate({
    provider: 'giphy',
    icon: '@logo/giphy.com',
    name: 'Get GIF by ID',
    description:
      'Fetch detailed information about a specific GIF using its Giphy ID',
    tags: ['giphy', 'gif', 'details'],
    secret: '@giphy',
    instruction: {
      method: 'GET',
      url: 'https://api.giphy.com',
      path: [
        '/v1/gifs/',
        field({
          name: 'gifId',
          description: 'The Giphy ID of the GIF',
          placeholder: true,
        }),
      ],
      query: {
        api_key: secret(),
      },
    },
  }),

  'giphy/stickers/search': createFetchTemplate({
    provider: 'giphy',
    icon: '@logo/giphy.com',
    name: 'Search Stickers',
    description:
      'Search for stickers (GIFs with transparent backgrounds) using keywords',
    tags: ['giphy', 'sticker', 'search', 'image'],
    secret: '@giphy',
    instruction: {
      method: 'GET',
      url: 'https://api.giphy.com',
      path: ['/v1/stickers/search'],
      query: {
        api_key: secret(),
        q: field({
          name: 'query',
          description: 'Search query for finding stickers',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 25,
          description: 'Number of results to return (max 50)',
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          optional: true,
          default: 0,
          description: 'Results offset for pagination',
        }),
        rating: field({
          name: 'rating',
          optional: true,
          enum: ['g', 'pg', 'pg-13', 'r'],
          default: 'g',
          description: 'Content rating filter (g, pg, pg-13, r)',
        }),
      },
    },
  }),

  'giphy/api/call': createFetchTemplate({
    provider: 'giphy',
    icon: '@logo/giphy.com',
    name: 'Call Giphy API',
    description:
      'Make a generic API call to Giphy. This is a flexible template that can be used to call any Giphy API endpoint by specifying the method, URL, and request body.',
    tags: ['giphy', 'api', 'call', 'generic'],
    secret: '@giphy',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Giphy API endpoint to call',
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
