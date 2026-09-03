import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'xero/accounting/api/call': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Call Xero Accounting API',
    description:
      'Make a generic API call to Xero Accounting. This is a flexible template that can be used to call accounting endpoints by specifying the method, URL, and request body.',
    tags: ['xero', 'accounting', 'api', 'call', 'generic'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Xero API endpoint to call',
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
