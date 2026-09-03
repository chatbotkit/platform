import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'listennotes/search': createFetchTemplate({
    provider: 'listennotes',
    icon: '@logo/listennotes.com',
    name: 'Search Podcasts and Episodes',
    description:
      'Full-text search for podcasts, episodes, or curated lists using keywords and filters',
    tags: ['listennotes', 'podcast', 'search', 'audio'],
    secret: '@listennotes',
    instruction: {
      method: 'GET',
      url: 'https://listen-api.listennotes.com',
      path: ['/api/v2/search'],
      query: {
        q: field({
          name: 'query',
          description:
            'Search term for finding podcasts or episodes (e.g., person, place, topic)',
        }),
        type: field({
          name: 'type',
          optional: true,
          enum: ['episode', 'podcast', 'curated'],
          default: 'episode',
          description: 'Type of content to search for',
        }),
        sort_by_date: field({
          name: 'sortByDate',
          type: 'number',
          optional: true,
          enum: [0, 1],
          default: 0,
          description: 'Sort by date (0 for relevance, 1 for date)',
        }),
        language: field({
          name: 'language',
          optional: true,
          description:
            'Limit results to a specific language (e.g., English, Spanish)',
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          optional: true,
          default: 0,
          description: 'Offset for pagination through search results',
        }),
      },
      headers: {
        'X-ListenAPI-Key': secret(),
      },
    },
  }),

  'listennotes/podcast/get': createFetchTemplate({
    provider: 'listennotes',
    icon: '@logo/listennotes.com',
    name: 'Get Podcast Details',
    description:
      'Get detailed information about a specific podcast including description, episodes, and metadata',
    tags: ['listennotes', 'podcast', 'details'],
    secret: '@listennotes',
    instruction: {
      method: 'GET',
      url: 'https://listen-api.listennotes.com',
      path: [
        '/api/v2/podcasts/',
        field({
          name: 'podcastId',
          description: 'The unique ID of the podcast',
        }),
      ],
      query: {
        next_episode_pub_date: field({
          name: 'nextEpisodePubDate',
          type: 'number',
          optional: true,
          description:
            'For episodes pagination - Unix timestamp in milliseconds from previous response',
        }),
        sort: field({
          name: 'sort',
          optional: true,
          enum: ['recent_first', 'oldest_first'],
          default: 'recent_first',
          description: 'Sort order for podcast episodes',
        }),
      },
      headers: {
        'X-ListenAPI-Key': secret(),
      },
    },
  }),

  'listennotes/episode/get': createFetchTemplate({
    provider: 'listennotes',
    icon: '@logo/listennotes.com',
    name: 'Get Episode Details',
    description:
      'Get detailed information about a specific podcast episode including audio URL, description, and transcript if available',
    tags: ['listennotes', 'episode', 'details', 'podcast'],
    secret: '@listennotes',
    instruction: {
      method: 'GET',
      url: 'https://listen-api.listennotes.com',
      path: [
        '/api/v2/episodes/',
        field({
          name: 'episodeId',
          description: 'The unique ID of the episode',
        }),
      ],
      query: {
        show_transcript: field({
          name: 'showTranscript',
          type: 'number',
          optional: true,
          enum: [0, 1],
          default: 0,
          description:
            'Include episode transcript if available (0 for no, 1 for yes)',
        }),
      },
      headers: {
        'X-ListenAPI-Key': secret(),
      },
    },
  }),

  'listennotes/languages': createFetchTemplate({
    provider: 'listennotes',
    icon: '@logo/listennotes.com',
    name: 'Get Supported Languages',
    description:
      'Get a list of all supported languages for filtering podcast search results',
    tags: ['listennotes', 'languages', 'metadata'],
    secret: '@listennotes',
    instruction: {
      method: 'GET',
      url: 'https://listen-api.listennotes.com',
      path: ['/api/v2/languages'],
      headers: {
        'X-ListenAPI-Key': secret(),
      },
    },
  }),

  'listennotes/api/call': createFetchTemplate({
    provider: 'listennotes',
    icon: '@logo/listennotes.com',
    name: 'Call Listennotes API',
    description:
      'Make a generic API call to Listennotes. This is a flexible template that can be used to call any Listennotes API endpoint by specifying the method, URL, and request body.',
    tags: ['listennotes', 'api', 'call', 'generic'],
    secret: '@listennotes',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Listennotes API endpoint to call',
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
