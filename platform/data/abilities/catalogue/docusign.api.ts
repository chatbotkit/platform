import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'docusign/api/call': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Call Docusign API',
    description:
      'Make a generic API call to Docusign. This is a flexible template that can be used to call any Docusign API endpoint by specifying the method, URL, and request body.',
    tags: ['docusign', 'api', 'call', 'generic'],
    secret: '@platform/docusign',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Docusign API endpoint to call',
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
