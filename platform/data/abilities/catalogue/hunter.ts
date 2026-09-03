import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Hunter.io abilities for email finding and verification.
 *
 * Hunter.io provides APIs for finding email addresses, verifying email deliverability,
 * and searching for company contacts.
 */
const abilities = {
  'hunter/email/find': createFetchTemplate({
    provider: 'hunter',
    icon: '@logo/hunter.io',
    name: 'Find Email Address',
    description:
      'Find the most likely email address from a domain name, first name, and last name',
    tags: ['hunter', 'email', 'finder', 'contact'],
    secret: '@hunter',
    instruction: {
      method: 'GET',
      url: 'https://api.hunter.io',
      path: ['/v2/email-finder'],
      query: {
        domain: field({
          name: 'domain',
          description: 'domain name to search (e.g., stripe.com)',
          optional: true,
        }),
        company: field({
          name: 'company',
          description: 'company name to search (e.g., stripe)',
          optional: true,
        }),
        first_name: field({
          name: 'firstName',
          description: 'first name of the person',
        }),
        last_name: field({
          name: 'lastName',
          description: 'last name of the person',
        }),
      },
      headers: {
        'X-API-KEY': secret(),
      },
    },
  }),

  'hunter/email/verify': createFetchTemplate({
    provider: 'hunter',
    icon: '@logo/hunter.io',
    name: 'Verify Email Address',
    description:
      "Check the deliverability of an email address and verify if it exists in Hunter's database",
    tags: ['hunter', 'email', 'verification', 'validation'],
    secret: '@hunter',
    instruction: {
      method: 'GET',
      url: 'https://api.hunter.io',
      path: ['/v2/email-verifier'],
      query: {
        email: field({
          name: 'email',
          description: 'email address to verify',
        }),
      },
      headers: {
        'X-API-KEY': secret(),
      },
    },
  }),

  'hunter/domain/search': createFetchTemplate({
    provider: 'hunter',
    icon: '@logo/hunter.io',
    name: 'Search Domain Emails',
    description:
      'Search all email addresses corresponding to a website or company',
    tags: ['hunter', 'domain', 'search', 'emails'],
    secret: '@hunter',
    instruction: {
      method: 'GET',
      url: 'https://api.hunter.io',
      path: ['/v2/domain-search'],
      query: {
        domain: field({
          name: 'domain',
          description: 'domain name to search (e.g., stripe.com)',
          optional: true,
        }),
        company: field({
          name: 'company',
          description: 'company name to search (e.g., stripe)',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of email addresses to return',
          optional: true,
          default: 10,
        }),
        type: field({
          name: 'type',
          description: 'filter by email type',
          optional: true,
          enum: ['personal', 'generic'],
        }),
      },
      headers: {
        'X-API-KEY': secret(),
      },
    },
  }),

  'hunter/email/count': createFetchTemplate({
    provider: 'hunter',
    icon: '@logo/hunter.io',
    name: 'Get Email Count',
    description: 'Get the number of email addresses Hunter has for a domain',
    tags: ['hunter', 'email', 'count', 'statistics'],
    secret: '@hunter',
    instruction: {
      method: 'GET',
      url: 'https://api.hunter.io',
      path: ['/v2/email-count'],
      query: {
        domain: field({
          name: 'domain',
          description: 'domain name to count emails for',
        }),
      },
      headers: {
        'X-API-KEY': secret(),
      },
    },
  }),

  'hunter/account/info': createFetchTemplate({
    provider: 'hunter',
    icon: '@logo/hunter.io',
    name: 'Get Account Information',
    description:
      'Get information about the Hunter.io account including remaining API calls',
    tags: ['hunter', 'account', 'info', 'usage'],
    secret: '@hunter',
    instruction: {
      method: 'GET',
      url: 'https://api.hunter.io',
      path: ['/v2/account'],
      headers: {
        'X-API-KEY': secret(),
      },
    },
  }),

  'hunter/api/call': createFetchTemplate({
    provider: 'hunter',
    icon: '@logo/hunter.io',
    name: 'Call Hunter API',
    description:
      'Make a generic API call to Hunter. This is a flexible template that can be used to call any Hunter API endpoint by specifying the method, URL, and request body.',
    tags: ['hunter', 'api', 'call', 'generic'],
    secret: '@hunter',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Hunter API endpoint to call',
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
