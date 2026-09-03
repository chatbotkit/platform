import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'serper/web/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Web',
    description: 'Search the web using Serper.',
    tags: ['serper', 'search', 'web'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/search',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/image/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Image',
    description: 'Search for images using Serper.',
    tags: ['serper', 'search', 'image'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/images',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/video/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Video',
    description: 'Search for videos using Serper.',
    tags: ['serper', 'search', 'video'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/videos',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/places/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Places',
    description: 'Search for places using Serper.',
    tags: ['serper', 'search', 'places'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/places',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/news/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search News',
    description: 'Search for news using Serper.',
    tags: ['serper', 'search', 'news'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/news',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/shoping/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Shopping',
    description: 'Search for shopping results using Serper.',
    tags: ['serper', 'search', 'shopping'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/shopping',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/scholar/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Scholar',
    description: 'Search for scholarly articles using Serper.',
    tags: ['serper', 'search', 'scholar'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/scholar',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/patent/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Patent',
    description: 'Search for patents using Serper.',
    tags: ['serper', 'search', 'patent'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/patents',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/autocomplete/search': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Search Autocomplete',
    description: 'Search for autocomplete results using Serper.',
    tags: ['serper', 'search', 'autocomplete'],
    secret: '@serper',
    instruction: {
      method: 'POST',
      url: 'https://google.serper.dev/autocomplete',
      headers: {
        'X-API-KEY': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({ name: 'q', description: 'the search query' }),
      },
    },
  }),

  'serper/api/call': createFetchTemplate({
    provider: 'serper',
    icon: 'https://serper.dev/apple-touch-icon.png',
    name: 'Call Serper API',
    description:
      'Make a generic API call to Serper. This is a flexible template that can be used to call any Serper API endpoint by specifying the method, URL, and request body.',
    tags: ['serper', 'api', 'call', 'generic'],
    secret: '@serper',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Serper API endpoint to call',
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

  'pack/serper': createPackTemplate({
    provider: 'serper',
    icon: '@logo/serper.dev',
    name: 'Install Serper Search Tools',
    description:
      'Installs Serper search tools into the conversation. You can perform web, image, video, news, places, shopping, scholar, and patent searches.',
    tags: ['serper', 'pack', 'beta'],
    secret: '@serper',
    instruction: {
      abilities: [
        'serper/web/search',
        'serper/image/search',
        'serper/video/search',
        'serper/places/search',
        'serper/news/search',
        'serper/shoping/search',
        'serper/scholar/search',
        'serper/patent/search',
        'serper/autocomplete/search',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
