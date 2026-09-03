import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'tavily/search': createFetchTemplate({
    provider: 'tavily',
    icon: '@logo/tavily.com',
    name: 'Search',
    description: 'Execute a search query using Tavily Search.',
    tags: ['tavily', 'search'],
    secret: '@tavily',
    instruction: {
      method: 'POST',
      url: 'https://api.tavily.com/search',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'the search query to execute',
        }),
        topic: field({
          name: 'topic',
          description: 'the category of the search',
          placeholder: true,
          optional: true,
          enum: ['general', 'news'],
        }),
        search_depth: field({
          name: 'searchDepth',
          description:
            'the depth of the search where advanced search returns the most relevant results',
          placeholder: true,
          optional: true,
          enum: ['basic', 'advanced'],
        }),
        chunks_per_source: field({
          name: 'chunksPerSource',
          type: 'number',
          description: 'the number of chunks to return per source',
          placeholder: true,
          optional: true,
          default: 3,
        }),
        max_results: field({
          name: 'maxResults',
          type: 'number',
          description: 'the maximum number of results to return',
          placeholder: true,
          optional: true,
          default: 5,
        }),
        time_range: field({
          name: 'timeRange',
          description: 'the time range back from the current date to filter results',
          placeholder: true,
          optional: true,
          enum: ['day', 'week', 'month', 'year'],
        }),
        include_answer: field({
          name: 'includeAnswer',
          type: 'boolean',
          description: 'whether to include the answer in the response',
          placeholder: true,
          optional: true,
        }),
        include_raw_content: field({
          name: 'includeRawContent',
          type: 'boolean',
          description: 'whether to include the raw content in the response',
          placeholder: true,
          optional: true,
        }),
        include_images: field({
          name: 'includeImages',
          type: 'boolean',
          description: 'whether to include images in the response',
          placeholder: true,
          optional: true,
        }),
        include_image_descriptions: field({
          name: 'includeImageDescriptions',
          type: 'boolean',
          description: 'whether to include image descriptions in the response',
          placeholder: true,
          optional: true,
        }),
      },
    },
  }),

  'tavily/extract': createFetchTemplate({
    provider: 'tavily',
    icon: '@logo/tavily.com',
    name: 'Extract',
    description: 'Extract web page content from one or more specified URLs.',
    tags: ['tavily', 'extract', 'web'],
    secret: '@tavily',
    instruction: {
      method: 'POST',
      url: 'https://api.tavily.com/extract',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        urls: [field({ name: 'url', description: 'the URL to extract content from' })],
        include_images: field({
          name: 'includeImages',
          type: 'boolean',
          description: 'whether to include images in the response',
          placeholder: true,
          optional: true,
        }),
        extract_depth: field({
          name: 'extractDepth',
          description:
            'the depth of the extraction where advanced extraction returns the most relevant results',
          placeholder: true,
          optional: true,
          enum: ['basic', 'advanced'],
        }),
      },
    },
  }),

  'tavily/api/call': createFetchTemplate({
    provider: 'tavily',
    icon: '@logo/tavily.com',
    name: 'Call Tavily API',
    description:
      'Make a generic API call to Tavily. This is a flexible template that can be used to call any Tavily API endpoint by specifying the method, URL, and request body.',
    tags: ['tavily', 'api', 'call', 'generic'],
    secret: '@tavily',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Tavily API endpoint to call',
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
