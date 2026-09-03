import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'godaddy/domain/check': createFetchTemplate({
    provider: 'godaddy',
    icon: '@logo/godaddy.com',
    name: 'Check Domain Availability with GoDaddy',
    description: 'Check the availability of a domain name using GoDaddy',
    tags: ['godaddy', 'domain'],
    secret: '@godaddy',
    instruction: {
      method: 'GET',
      url: 'https://api.godaddy.com/v1/domains/available',
      query: {
        domain: field({
          name: 'domain',
          description: 'domain name',
        }),
      },
      headers: {
        authorization: secret(),
      },
    },
  }),

  'godaddy/api/call': createFetchTemplate({
    provider: 'godaddy',
    icon: '@logo/godaddy.com',
    name: 'Call Godaddy API',
    description:
      'Make a generic API call to Godaddy. This is a flexible template that can be used to call any Godaddy API endpoint by specifying the method, URL, and request body.',
    tags: ['godaddy', 'domain', 'check', 'api', 'call', 'generic'],
    secret: '@godaddy',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Godaddy API endpoint to call',
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
