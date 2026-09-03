import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'beehiiv/publication/list': createFetchTemplate({
    provider: 'beehiiv',
    icon: '@logo/beehiiv.com',
    name: 'List Publications',
    description:
      'Retrieve a list of all publications associated with beehiiv account',
    tags: ['beehiiv', 'newsletter', 'publication'],
    secret: '@beehiiv',
    instruction: {
      method: 'GET',
      url: 'https://api.beehiiv.com',
      path: ['/v2/publications'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'beehiiv/subscriber/create': createFetchTemplate({
    provider: 'beehiiv',
    icon: '@logo/beehiiv.com',
    name: 'Create Subscriber',
    description:
      'Add a new subscriber to a beehiiv publication with optional settings',
    tags: ['beehiiv', 'newsletter', 'subscriber', 'email'],
    secret: '@beehiiv',
    instruction: {
      method: 'POST',
      url: 'https://api.beehiiv.com',
      path: [
        '/v2/publications/',
        field({
          name: 'publicationId',
          description: 'The ID of the publication to subscribe to',
          placeholder: true,
        }),
        '/subscriptions',
      ],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        email: field({
          name: 'email',
          description: 'The email address of the subscriber',
        }),
        reactivate_existing: field({
          name: 'reactivateExisting',
          type: 'boolean',
          description:
            'Whether to reactivate the subscriber if they previously unsubscribed',
          optional: true,
          default: false,
        }),
        send_welcome_email: field({
          name: 'sendWelcomeEmail',
          type: 'boolean',
          description: 'Whether to send a welcome email to the subscriber',
          optional: true,
          default: false,
        }),
        utm_source: field({
          name: 'utmSource',
          description: 'UTM source parameter for tracking subscriber origin',
          optional: true,
        }),
      },
    },
  }),

  'beehiiv/api/call': createFetchTemplate({
    provider: 'beehiiv',
    icon: '@logo/beehiiv.com',
    name: 'Call Beehiiv API',
    description:
      'Make a generic API call to Beehiiv. This is a flexible template that can be used to call any Beehiiv API endpoint by specifying the method, URL, and request body.',
    tags: ['beehiiv', 'api', 'call', 'generic'],
    secret: '@beehiiv',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Beehiiv API endpoint to call',
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
