import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Ahrefs abilities for SEO and backlink analysis.
 */
const abilities = {
  'ahrefs/backlinks/list': createFetchTemplate({
    provider: 'ahrefs',
    icon: '@logo/ahrefs.com',
    name: 'Get Backlinks',
    description:
      'Get backlinks for a domain or URL with details for the referring pages including anchor text and page titles',
    tags: ['ahrefs', 'seo', 'backlinks', 'analysis'],
    secret: '@platform/ahrefs',
    instruction: {
      method: 'GET',
      url: 'https://api.ahrefs.com',
      path: ['/v3/site-explorer/all-backlinks'],
      headers: {
        Authorization: secret(),
      },
      query: {
        target: field({
          name: 'target',
          description: 'the domain or URL to analyze',
        }),
        select: field({
          name: 'select',
          description:
            'comma-separated list of columns to return (e.g., "url_from,anchor,title")',
        }),
        mode: field({
          name: 'mode',
          description: 'analysis mode: exact, domain, subdomains, or prefix',
          enum: ['exact', 'domain', 'subdomains', 'prefix'],
          default: 'domain',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results to return',
          default: 1000,
          optional: true,
        }),
      },
    },
  }),

  'ahrefs/backlinks/list[one-per-domain]': createFetchTemplate({
    provider: 'ahrefs',
    icon: '@logo/ahrefs.com',
    name: 'Get Backlinks One Per Domain',
    description:
      'Get one backlink with the highest ahrefs_rank per referring domain for a target URL or domain',
    tags: ['ahrefs', 'seo', 'backlinks', 'analysis', 'aggregated'],
    secret: '@platform/ahrefs',
    instruction: {
      method: 'GET',
      url: 'https://api.ahrefs.com',
      path: ['/v3/site-explorer/all-backlinks'],
      headers: {
        Authorization: secret(),
      },
      query: {
        target: field({
          name: 'target',
          description: 'the domain or URL to analyze',
        }),
        select: field({
          name: 'select',
          description:
            'comma-separated list of columns to return (e.g., "url_from,anchor,title")',
        }),
        aggregation: '1_per_domain',
        mode: field({
          name: 'mode',
          description: 'analysis mode: exact, domain, subdomains, or prefix',
          enum: ['exact', 'domain', 'subdomains', 'prefix'],
          default: 'domain',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results to return',
          default: 1000,
          optional: true,
        }),
      },
    },
  }),

  'ahrefs/referring-domains/list': createFetchTemplate({
    provider: 'ahrefs',
    icon: '@logo/ahrefs.com',
    name: 'Get Referring Domains',
    description:
      'Get the referring domains that contain backlinks to the target URL or domain with domain metrics',
    tags: ['ahrefs', 'seo', 'referring-domains', 'analysis'],
    secret: '@platform/ahrefs',
    instruction: {
      method: 'GET',
      url: 'https://api.ahrefs.com',
      path: ['/v3/site-explorer/refdomains'],
      headers: {
        Authorization: secret(),
      },
      query: {
        target: field({
          name: 'target',
          description: 'the domain or URL to analyze',
        }),
        select: field({
          name: 'select',
          description:
            'comma-separated list of columns to return (e.g., "domain_from,domain_rating,backlinks")',
        }),
        mode: field({
          name: 'mode',
          description: 'analysis mode: exact, domain, subdomains, or prefix',
          enum: ['exact', 'domain', 'subdomains', 'prefix'],
          default: 'domain',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results to return',
          default: 1000,
          optional: true,
        }),
      },
    },
  }),

  'ahrefs/api/call': createFetchTemplate({
    provider: 'ahrefs',
    icon: '@logo/ahrefs.com',
    name: 'Call Ahrefs API',
    description:
      'Make a generic API call to Ahrefs. This is a flexible template that can be used to call any Ahrefs API endpoint by specifying the method, URL, and request body.',
    tags: ['ahrefs', 'api', 'call', 'generic'],
    secret: '@platform/ahrefs',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Ahrefs API endpoint to call',
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
