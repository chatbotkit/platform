import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'diffbot/page/extract': createFetchTemplate({
    provider: 'diffbot',
    icon: '@logo/diffbot.com',
    name: 'Extract Web Page Data',
    description:
      'Automatically classify a web page and extract structured data according to its type (article, product, discussion, etc.)',
    tags: ['diffbot', 'web scraping', 'data extraction', 'content analysis'],
    secret: '@diffbot',
    instruction: {
      method: 'GET',
      url: 'https://api.diffbot.com',
      path: ['/v3/analyze'],
      query: {
        token: secret(),
        url: field({
          name: 'url',
          description: 'The URL of the web page to extract data from',
        }),
      },
    },
  }),

  'diffbot/entity/enhance': createFetchTemplate({
    provider: 'diffbot',
    icon: '@logo/diffbot.com',
    name: 'Enhance Entity Data',
    description:
      'Enrich a person or organization entity with comprehensive data from Diffbot Knowledge Graph using partial information',
    tags: ['diffbot', 'entity enrichment', 'knowledge graph', 'data enhancement'],
    secret: '@diffbot',
    instruction: {
      method: 'POST',
      url: 'https://kg.diffbot.com',
      path: ['/kg/v3/enhance'],
      query: {
        token: secret(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        type: field({
          name: 'type',
          description: 'The entity type to enhance',
          enum: ['person', 'organization'],
        }),
        name: field({
          name: 'name',
          description: 'The name of the entity to enhance',
          optional: true,
        }),
        location: field({
          name: 'location',
          description: 'The location of the entity',
          optional: true,
        }),
        url: field({
          name: 'url',
          description: 'A URL associated with the entity (LinkedIn, website, etc.)',
          optional: true,
        }),
      },
    },
  }),

  'diffbot/article/extract': createFetchTemplate({
    provider: 'diffbot',
    icon: '@logo/diffbot.com',
    name: 'Extract Article Content',
    description:
      'Extract clean article content including title, author, text, images, and metadata from any article URL',
    tags: ['diffbot', 'article extraction', 'content scraping', 'web scraping'],
    secret: '@diffbot',
    instruction: {
      method: 'GET',
      url: 'https://api.diffbot.com',
      path: ['/v3/article'],
      query: {
        token: secret(),
        url: field({
          name: 'url',
          description: 'The URL of the article to extract',
        }),
      },
    },
  }),

  'diffbot/product/extract': createFetchTemplate({
    provider: 'diffbot',
    icon: '@logo/diffbot.com',
    name: 'Extract Product Data',
    description:
      'Extract structured product information including title, description, price, images, and specifications from product pages',
    tags: ['diffbot', 'product extraction', 'e-commerce', 'web scraping'],
    secret: '@diffbot',
    instruction: {
      method: 'GET',
      url: 'https://api.diffbot.com',
      path: ['/v3/product'],
      query: {
        token: secret(),
        url: field({
          name: 'url',
          description: 'The URL of the product page to extract',
        }),
      },
    },
  }),

  'diffbot/api/call': createFetchTemplate({
    provider: 'diffbot',
    icon: '@logo/diffbot.com',
    name: 'Call Diffbot API',
    description:
      'Make a generic API call to Diffbot. This is a flexible template that can be used to call any Diffbot API endpoint by specifying the method, URL, and request body.',
    tags: ['diffbot', 'api', 'call', 'generic'],
    secret: '@diffbot',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Diffbot API endpoint to call',
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
