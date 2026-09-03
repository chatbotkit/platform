import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/serpapi/proxy'

const abilities = {
  'serpapi/web/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Web',
    description: 'Search the SERP using SerpApi.',
    tags: ['search', 'web', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/image/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Image',
    description: 'Search for images using SerpApi.',
    tags: ['search', 'image', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_images',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/news/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search News',
    description: 'Search for news using SerpApi.',
    tags: ['search', 'news', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_news',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/video/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Video',
    description: 'Search for videos using SerpApi.',
    tags: ['search', 'video', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_videos',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/shopping/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Shopping',
    description: 'Search for shopping results using SerpApi.',
    tags: ['search', 'shopping', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_shopping',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/product/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Product',
    description: 'Search for product results using SerpApi.',
    tags: ['search', 'product', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_products',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/scholar/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Scholar',
    description: 'Search for scholarly articles using SerpApi.',
    tags: ['search', 'scholar', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_scholar',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/finance/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Finance',
    description: 'Search for financial results using SerpApi.',
    tags: ['search', 'finance', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_finance',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/event/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Event',
    description: 'Search for events using SerpApi.',
    tags: ['search', 'event', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_events',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/local/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Local',
    description: 'Search for local results using SerpApi.',
    tags: ['search', 'local', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_local',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/job/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Job',
    description: 'Search for job listings using SerpApi.',
    tags: ['search', 'job', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_jobs',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/patent/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Patent',
    description: 'Search for patents using SerpApi.',
    tags: ['search', 'patent', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_patents',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/flight/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Flight',
    description: 'Search for flights using SerpApi.',
    tags: ['search', 'flight', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_flights',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/hotel/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Hotel',
    description: 'Search for hotels using SerpApi.',
    tags: ['search', 'hotel', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_hotels',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpaapi/autocomplete/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Autocomplete',
    description: 'Search for autocomplete suggestions using SerpApi.',
    tags: ['search', 'autocomplete', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_autocomplete',
        q: field({ name: 'q', description: 'The search query' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'serpapi/trends/search': createAuxiliaryTemplate<Schema>({
    provider: 'serpapi',
    icon: '@logo/serpapi.com',
    name: 'Search Trends',
    description: 'Search for search trends using SerpApi.',
    tags: ['search', 'trends', 'serpapi'],
    path: '/api/auxiliary/skillset/ability/serpapi/proxy',
    secret: '@serpapi',
    instruction: {
      method: 'GET',
      url: '/search',
      query: {
        engine: 'google_trends',
        q: field({
          name: 'q',
          description: 'the trends to search for separated by commas',
        }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
