import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'vonage/sms/send': createFetchTemplate({
    provider: 'vonage',
    icon: '@logo/vonage.com',
    name: 'Send Vonage SMS',
    description: 'Send an SMS to a specified phone number using Vonage',
    tags: ['vonage', 'sms'],
    secret: '@vonage',
    instruction: {
      method: 'POST',
      url: 'https://rest.nexmo.com',
      path: ['/sms/json'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        from: field({
          name: 'from',
          description: 'sender ID or phone number',
        }),
        to: field({
          name: 'to',
          description: "recipient's phone number",
        }),
        text: field({
          name: 'text',
          description: 'message content',
        }),
      },
    },
  }),

  'vonage/sms/status/fetch': createFetchTemplate({
    provider: 'vonage',
    icon: '@logo/vonage.com',
    name: 'Check Vonage SMS Status',
    description: 'Check the status of a sent SMS using Vonage',
    tags: ['vonage', 'sms', 'status'],
    secret: '@vonage',
    instruction: {
      method: 'GET',
      url: 'https://rest.nexmo.com',
      path: ['/search/message'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        id: field({
          name: 'id',
          description: 'the message ID',
        }),
      },
    },
  }),

  'vonage/api/call': createFetchTemplate({
    provider: 'vonage',
    icon: '@logo/vonage.com',
    name: 'Call Vonage API',
    description:
      'Make a generic API call to Vonage. This is a flexible template that can be used to call any Vonage API endpoint by specifying the method, URL, and request body.',
    tags: ['vonage', 'sms', 'api', 'call', 'generic'],
    secret: '@vonage',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Vonage API endpoint to call',
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
