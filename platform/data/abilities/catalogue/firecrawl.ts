import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'firecrawl/url/scrape': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Scrape URL',
    description:
      'Scrape a single URL and optionally extract information using an LLM.',
    tags: ['firecrawl', 'scrape', 'web'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/scrape',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description: 'The URL to scrape',
        }),
        onlyMainContent: field({
          name: 'onlyMainContent',
          type: 'boolean',
          description:
            'Only return the main content of the page excluding headers, navs, footers, etc.',
          optional: true,
          default: true,
        }),
      },
    },
  }),

  'firecrawl/crawl/start': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Start Crawl',
    description: 'Crawl multiple URLs starting from a base URL.',
    tags: ['firecrawl', 'crawl', 'web'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/crawl',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description: 'The base URL to start crawling from',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'Maximum number of pages to crawl',
          optional: true,
          default: 100,
        }),
        maxDepth: field({
          name: 'maxDepth',
          type: 'number',
          description: 'Maximum depth to crawl relative to the base URL',
          optional: true,
          default: 10,
        }),
        includePaths: array({
          items: field({
            name: 'includePath',
            description:
              'URL pathname regex pattern that includes matching URLs in the crawl',
          }),
        }),
        excludePaths: array({
          items: field({
            name: 'excludePath',
            description:
              'URL pathname regex pattern that excludes matching URLs from the crawl',
          }),
        }),
      },
    },
  }),

  'firecrawl/crawl/fetch': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Get Crawl Status',
    description: 'Get the status and results of a crawl job.',
    tags: ['firecrawl', 'crawl', 'status'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/crawl/',
        field({
          name: 'id',
          description: 'The ID of the crawl job',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/crawl/cancel': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Cancel Crawl',
    description: 'Cancel a running crawl job.',
    tags: ['firecrawl', 'crawl', 'cancel'],
    secret: '@firecrawl',
    instruction: {
      method: 'DELETE',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/crawl/',
        field({
          name: 'id',
          description: 'The ID of the crawl job to cancel',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/crawl/list': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'List Active Crawls',
    description: 'Get all active crawls for the authenticated team.',
    tags: ['firecrawl', 'crawl', 'list'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1/crawl/active',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/map/create': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Map URLs',
    description: 'Map and discover all URLs from a website.',
    tags: ['firecrawl', 'map', 'discovery'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/map',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description: 'The base URL to start mapping from',
        }),
        search: field({
          name: 'search',
          description: 'Search query to use for mapping',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'Maximum number of links to return (default: 5000)',
          optional: true,
          default: 5000,
        }),
        includeSubdomains: field({
          name: 'includeSubdomains',
          type: 'boolean',
          description: 'Include subdomains of the website',
          optional: true,
          default: true,
        }),
      },
    },
  }),

  'firecrawl/search/create': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Search',
    description: 'Search the web and optionally scrape search results.',
    tags: ['firecrawl', 'search', 'web'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/search',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'The search query',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          optional: true,
          default: 5,
        }),
        location: field({
          name: 'location',
          description: 'Location parameter for search results',
          optional: true,
        }),
      },
    },
  }),

  'firecrawl/extract/start': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Start Extraction',
    description: 'Extract structured data from pages using LLMs.',
    tags: ['firecrawl', 'extract', 'llm'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/extract',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        urls: array({
          items: field({
            name: 'url',
            description: 'URL to extract data from (supports glob format)',
          }),
        }),
        prompt: field({
          name: 'prompt',
          description: 'Prompt to guide the extraction process',
          optional: true,
        }),
        enableWebSearch: field({
          name: 'enableWebSearch',
          type: 'boolean',
          description:
            'When true, the extraction will use web search to find additional data',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'firecrawl/extract/fetch': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Get Extract Status',
    description: 'Get the status of an extract job.',
    tags: ['firecrawl', 'extract', 'status'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/extract/',
        field({
          name: 'id',
          description: 'The ID of the extract job',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/research/start': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Start Deep Research',
    description: 'Start a deep research operation on a query.',
    tags: ['firecrawl', 'research', 'llm'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/deep-research',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'The query to research',
        }),
        maxDepth: field({
          name: 'maxDepth',
          type: 'number',
          description: 'Maximum depth of research iterations 1-12',
          optional: true,
          default: 7,
        }),
        timeLimit: field({
          name: 'timeLimit',
          type: 'number',
          description: 'Time limit in seconds 30-600',
          optional: true,
          default: 300,
        }),
        maxUrls: field({
          name: 'maxUrls',
          type: 'number',
          description: 'Maximum number of URLs to analyze 1-1000',
          optional: true,
          default: 20,
        }),
      },
    },
  }),

  'firecrawl/research/fetch': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Get Research Status',
    description: 'Get the status and results of a deep research operation.',
    tags: ['firecrawl', 'research', 'status'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/deep-research/',
        field({
          name: 'id',
          description: 'The ID of the research job',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/llmstxt/start': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Generate LLMs.txt',
    description: 'Generate LLMs.txt for a website.',
    tags: ['firecrawl', 'llmstxt', 'web'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/llmstxt',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description: 'The URL to generate LLMs.txt from',
        }),
        maxUrls: field({
          name: 'maxUrls',
          type: 'number',
          description: 'Maximum number of URLs to analyze',
          optional: true,
          default: 2,
        }),
        showFullText: field({
          name: 'showFullText',
          type: 'boolean',
          description: 'Include full text content in the response',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'firecrawl/llmstxt/fetch': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Get LLMs.txt Status',
    description: 'Get the status and results of an LLMs.txt generation job.',
    tags: ['firecrawl', 'llmstxt', 'status'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/llmstxt/',
        field({
          name: 'id',
          description: 'The ID of the LLMs.txt generation job',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/credits/fetch': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Get Credit Usage',
    description: 'Get remaining credits for the authenticated team.',
    tags: ['firecrawl', 'billing', 'credits'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1/team/credit-usage',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/batch/start': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Start Batch Scrape',
    description:
      'Scrape multiple URLs and optionally extract information using an LLM.',
    tags: ['firecrawl', 'batch', 'scrape'],
    secret: '@firecrawl',
    instruction: {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v1/batch/scrape',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        urls: array({
          items: field({
            name: 'url',
            description: 'URL to scrape',
          }),
        }),
      },
    },
  }),

  'firecrawl/batch/fetch': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Get Batch Scrape Status',
    description: 'Get the status of a batch scrape job.',
    tags: ['firecrawl', 'batch', 'status'],
    secret: '@firecrawl',
    instruction: {
      method: 'GET',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/batch/scrape/',
        field({
          name: 'id',
          description: 'The ID of the batch scrape job',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/batch/cancel': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Cancel Batch Scrape',
    description: 'Cancel a batch scrape job.',
    tags: ['firecrawl', 'batch', 'cancel'],
    secret: '@firecrawl',
    instruction: {
      method: 'DELETE',
      url: 'https://api.firecrawl.dev/v1',
      path: [
        '/batch/scrape/',
        field({
          name: 'id',
          description: 'The ID of the batch scrape job to cancel',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'firecrawl/api/call': createFetchTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Call Firecrawl API',
    description:
      'Make a generic API call to Firecrawl. This is a flexible template that can be used to call any Firecrawl API endpoint by specifying the method, URL, and request body.',
    tags: ['firecrawl', 'api', 'call', 'generic'],
    secret: '@firecrawl',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Firecrawl API endpoint to call',
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

  'pack/firecrawl': createPackTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Install Firecrawl Tools',
    description:
      'Installs Firecrawl tools into the conversation. You can scrape URLs, crawl websites, extract data, and perform web research.',
    tags: ['firecrawl', 'pack', 'beta'],
    secret: '@firecrawl',
    instruction: {
      abilities: [
        'firecrawl/url/scrape',
        'firecrawl/crawl/start',
        'firecrawl/crawl/fetch',
        'firecrawl/crawl/cancel',
        'firecrawl/crawl/list',
        'firecrawl/map/create',
        'firecrawl/search/create',
        'firecrawl/extract/start',
        'firecrawl/extract/fetch',
        'firecrawl/research/start',
        'firecrawl/research/fetch',
        'firecrawl/batch/start',
        'firecrawl/batch/fetch',
        'firecrawl/batch/cancel',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/firecrawl[read-only]': createPackTemplate({
    provider: 'firecrawl',
    icon: '@logo/firecrawl.dev',
    name: 'Install with Firecrawl Search Tools',
    description:
      'Use this pack to search and extract data from websites using Firecrawl. Read-only web scraping and data extraction.',
    tags: ['firecrawl', 'pack', 'beta'],
    secret: '@firecrawl',
    instruction: {
      abilities: [
        'firecrawl/url/scrape',
        'firecrawl/crawl/fetch',
        'firecrawl/crawl/list',
        'firecrawl/map/create',
        'firecrawl/search/create',
        'firecrawl/extract/fetch',
        'firecrawl/research/fetch',
        'firecrawl/batch/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
