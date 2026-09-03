import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'mailgun/api/call': createFetchTemplate({
    provider: 'mailgun',
    icon: '@logo/mailgun.com',
    name: 'Call Mailgun API',
    description:
      'Make a generic API call to Mailgun. This is a flexible template that can be used to call any Mailgun API endpoint by specifying the method, URL, and request body.',
    tags: ['mailgun', 'email', 'verify', 'api', 'call', 'generic'],
    secret: '@mailgun',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Mailgun API endpoint to call',
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
