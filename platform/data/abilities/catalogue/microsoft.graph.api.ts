import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'microsoft/graph/api/call': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Call Microsoft API',
    description:
      'Make a generic API call to Microsoft. This is a flexible template that can be used to call any Microsoft API endpoint by specifying the method, URL, and request body.',
    tags: ['microsoft', 'graph', 'api', 'call', 'generic'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Microsoft API endpoint to call',
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
