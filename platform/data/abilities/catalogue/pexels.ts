import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'pexels/photo/search': createFetchTemplate({
    provider: 'pexels',
    icon: '@logo/pexels.com',
    name: 'Search Photos',
    description:
      'Search for high-quality free stock photos on Pexels using keywords, with optional filters for orientation, size, and color',
    tags: ['pexels', 'photos', 'images', 'stock', 'search'],
    secret: '@pexels',
    instruction: {
      method: 'GET',
      url: 'https://api.pexels.com',
      path: ['/v1/search'],
      query: {
        query: field({
          name: 'query',
          description:
            'Search query for photos (e.g., "nature", "business", "technology")',
        }),
        orientation: field({
          name: 'orientation',
          description: 'Photo orientation filter',
          optional: true,
          enum: ['landscape', 'portrait', 'square'],
        }),
        size: field({
          name: 'size',
          description: 'Minimum photo size filter',
          optional: true,
          enum: ['large', 'medium', 'small'],
        }),
        color: field({
          name: 'color',
          description:
            'Photo color filter (e.g., "red", "blue", "green", or hex code like "#ffffff")',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
          default: 1,
        }),
        per_page: field({
          name: 'perPage',
          type: 'number',
          description: 'Number of results per page (max 80)',
          optional: true,
          default: 15,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'pexels/photo/get': createFetchTemplate({
    provider: 'pexels',
    icon: '@logo/pexels.com',
    name: 'Get Photo Details',
    description:
      'Retrieve detailed information about a specific photo by its ID, including photographer, source URL, and available sizes',
    tags: ['pexels', 'photos', 'images', 'details'],
    secret: '@pexels',
    instruction: {
      method: 'GET',
      url: 'https://api.pexels.com',
      path: [
        '/v1/photos/',
        field({
          name: 'photoId',
          description: 'The ID of the photo to retrieve',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'pexels/photo/curated': createFetchTemplate({
    provider: 'pexels',
    icon: '@logo/pexels.com',
    name: 'Get Curated Photos',
    description:
      'Retrieve curated photos from Pexels - a hand-picked selection of high-quality photos updated daily',
    tags: ['pexels', 'photos', 'images', 'curated', 'featured'],
    secret: '@pexels',
    instruction: {
      method: 'GET',
      url: 'https://api.pexels.com',
      path: ['/v1/curated'],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
          default: 1,
        }),
        per_page: field({
          name: 'perPage',
          type: 'number',
          description: 'Number of results per page (max 80)',
          optional: true,
          default: 15,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'pexels/api/call': createFetchTemplate({
    provider: 'pexels',
    icon: '@logo/pexels.com',
    name: 'Call Pexels API',
    description:
      'Make a generic API call to Pexels. This is a flexible template that can be used to call any Pexels API endpoint by specifying the method, URL, and request body.',
    tags: ['pexels', 'photo', 'api', 'call', 'generic'],
    secret: '@pexels',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Pexels API endpoint to call',
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
