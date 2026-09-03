import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'sendgrid/email/send': createFetchTemplate({
    provider: 'sendgrid',
    icon: '@logo/sendgrid.com',
    name: 'Send SendGrid Email',
    description: 'Send an email to a specified recipient using SendGrid',
    tags: ['sendgrid', 'email'],
    secret: '@sendgrid',
    instruction: {
      method: 'POST',
      url: 'https://api.sendgrid.com/v3/mail/send',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        personalizations: [
          {
            to: [
              {
                email: field({
                  name: 'to',
                  description: "recipient's email address",
                  placeholder: true,
                }),
              },
            ],
            subject: field({
              name: 'subject',
              description: 'email subject',
              placeholder: true,
            }),
          },
        ],
        from: {
          email: field({
            name: 'from',
            description: "sender's email address",
            placeholder: true,
          }),
        },
        content: [
          {
            type: 'text/plain',
            value: field({
              name: 'content',
              description: 'email content',
            }),
          },
        ],
      },
    },
  }),

  'sendgrid/api/call': createFetchTemplate({
    provider: 'sendgrid',
    icon: '@logo/sendgrid.com',
    name: 'Call Sendgrid API',
    description:
      'Make a generic API call to Sendgrid. This is a flexible template that can be used to call any Sendgrid API endpoint by specifying the method, URL, and request body.',
    tags: ['sendgrid', 'email', 'send', 'api', 'call', 'generic'],
    secret: '@sendgrid',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Sendgrid API endpoint to call',
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
