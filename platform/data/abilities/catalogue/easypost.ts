import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'easypost/tracking': createFetchTemplate({
    provider: 'easypost',
    icon: '@logo/easypost.com',
    name: 'Check Package Tracking Status with EasyPost',
    description: 'Track a package with carrier details using EasyPost',
    tags: ['logistics', 'tracking', 'easypost'],
    secret: '@easypost',
    instruction: {
      method: 'GET',
      url: 'https://api.easypost.com/v2/tracks/',
      path: [
        field({
          name: 'carrier',
          description: 'carrier name',
        }),
        '/',
        field({
          name: 'tracking_number',
          description: 'tracking number',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'easypost/api/call': createFetchTemplate({
    provider: 'easypost',
    icon: '@logo/easypost.com',
    name: 'Call Easypost API',
    description:
      'Make a generic API call to Easypost. This is a flexible template that can be used to call any Easypost API endpoint by specifying the method, URL, and request body.',
    tags: ['easypost', 'tracking', 'api', 'call', 'generic'],
    secret: '@easypost',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Easypost API endpoint to call',
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
