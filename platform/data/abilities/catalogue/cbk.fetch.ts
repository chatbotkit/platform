import {
  createFetchTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of fetch and HTTP request abilities.
 */
const abilities = {
  // --- Fetch Text ---

  'fetch/text/get': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Web Page',
    description:
      'Fetch the content of a web page using a URL and convert it to text',
    tags: ['fetch', 'page', 'text', 'get'],
    instruction: {
      url: field({
        name: 'url',
        description: 'the url of the page to fetch, including https:// prefix',
        placeholder: true,
      }),
      options: {
        format: 'text',
      },
    },
  }),

  // --- Fetch Metadata ---

  'fetch/metadata': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Metadata',
    description:
      'Fetch the title, description, keywords, icon and other metadata of a web page',
    tags: ['fetch', 'metadata'],
    instruction: {
      method: 'POST',
      url: '/api/auxiliary/skillset/ability/chatbotkit/url/unfurl',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description:
            'the url of the page to fetch, including https:// prefix',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    },
  }),

  // --- Custom HTTP Requests ---

  'fetch/request': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'HTTP Request',
    description: 'Make an HTTP request',
    tags: ['fetch', 'http', 'request', 'api', 'custom', 'public'],
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method',
      }),
      url: field({
        name: 'url',
        description: 'URL',
      }),
      headers: object({
        name: 'headers',
        description: 'additional HTTP headers',
        optional: true,
        shape: {},
      }),
      body: field({
        name: 'body',
        description: 'request body as text - for POST, PUT, PATCH requests',
        optional: true,
      }),
    },
  }),

  'fetch/request[with-auth]': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'HTTP Request',
    description: 'Make an HTTP request',
    tags: ['fetch', 'http', 'request', 'api', 'custom'],
    secret: '@bearer',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method',
      }),
      url: field({
        name: 'url',
        description: 'URL',
      }),
      headers: object({
        name: 'headers',
        description: 'additional HTTP headers',
        optional: true,
        shape: {},
      }),
      authorization: secret(),
      body: field({
        name: 'body',
        description: 'request body as text - for POST, PUT, PATCH requests',
        optional: true,
      }),
    },
  }),

  // --- Examples ---

  'example/fetch/api/get': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Web API',
    description:
      'Fetch data from a web API using a URL and optional parameters',
    tags: ['fetch', 'api', 'get'],
    secret: '@bearer',
    instruction: {
      method: 'GET',
      url: 'https://api.example.com/data',
      query: {
        param1: 'value1',
        param2: 'value2',
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'example/fetch/api/post': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Post Data to Web API',
    description: 'Post data to a web API using a URL and JSON payload',
    tags: ['fetch', 'api', 'post'],
    secret: '@bearer',
    instruction: {
      method: 'POST',
      url: 'https://api.example.com/data',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        key: 'value',
      },
    },
  }),

  'example/fetch/api/post[params]': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Post Data to Web API with Parameters',
    description: 'Post data to a web API using a URL and form parameters',
    tags: ['fetch', 'api', 'post'],
    secret: '@bearer',
    instruction: {
      method: 'POST',
      url: 'https://api.example.com/data',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        param1: field({
          name: 'param1',
          description: 'The description of param1',
        }),
        param2: field({
          name: 'param2',
          description: 'The description of param2',
        }),
      },
    },
  }),
}

export default abilities
