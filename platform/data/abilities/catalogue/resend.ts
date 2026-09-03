import {
  array,
  createFetchTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'resend/email/send': createFetchTemplate({
    provider: 'resend',
    icon: '@logo/resend.com',
    name: 'Send Email with Resend',
    description:
      'Send transactional or marketing emails with support for HTML content, attachments, and scheduling',
    tags: ['resend', 'email', 'send', 'transactional'],
    secret: '@resend',
    instruction: {
      method: 'POST',
      url: 'https://api.resend.com',
      path: ['/emails'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        from: field({
          name: 'from',
          description:
            'sender email address in format "Name <email@domain.com>"',
        }),
        to: array({
          items: field({
            name: 'recipient',
            description: 'recipient email address',
          }),
        }),
        subject: field({
          name: 'subject',
          description: 'email subject line',
        }),
        html: field({
          name: 'html',
          description: 'HTML version of the email content',
          optional: true,
        }),
        text: field({
          name: 'text',
          description: 'plain text version of the email content',
          optional: true,
        }),
        cc: field({
          name: 'cc',
          description: 'carbon copy email address',
          optional: true,
        }),
        bcc: field({
          name: 'bcc',
          description: 'blind carbon copy email address',
          optional: true,
        }),
        reply_to: field({
          name: 'replyTo',
          description: 'reply-to email address',
          optional: true,
        }),
      },
    },
  }),

  'resend/email/retrieve': createFetchTemplate({
    provider: 'resend',
    icon: '@logo/resend.com',
    name: 'Retrieve Email Details',
    description:
      'Fetch details and status for a previously sent or scheduled email',
    tags: ['resend', 'email', 'retrieve', 'status'],
    secret: '@resend',
    instruction: {
      method: 'GET',
      url: 'https://api.resend.com',
      path: [
        '/emails/',
        field({
          name: 'emailId',
          description: 'the email ID to retrieve',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'resend/email/cancel': createFetchTemplate({
    provider: 'resend',
    icon: '@logo/resend.com',
    name: 'Cancel Scheduled Email',
    description: 'Cancel a scheduled email before it is sent',
    tags: ['resend', 'email', 'cancel', 'scheduled'],
    secret: '@resend',
    instruction: {
      method: 'POST',
      url: 'https://api.resend.com',
      path: [
        '/emails/',
        field({
          name: 'emailId',
          description: 'the email ID to cancel',
        }),
        '/cancel',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'resend/email/update': createFetchTemplate({
    provider: 'resend',
    icon: '@logo/resend.com',
    name: 'Update Scheduled Email',
    description:
      'Update properties of a scheduled email such as the scheduled time',
    tags: ['resend', 'email', 'update', 'scheduled'],
    secret: '@resend',
    instruction: {
      method: 'PATCH',
      url: 'https://api.resend.com',
      path: [
        '/emails/',
        field({
          name: 'emailId',
          description: 'the email ID to update',
        }),
      ],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        scheduled_at: field({
          name: 'scheduledAt',
          description:
            'new scheduled time in ISO 8601 format or natural language like "in 1 hour"',
          optional: true,
        }),
      },
    },
  }),

  'resend/api/call': createFetchTemplate({
    provider: 'resend',
    icon: '@logo/resend.com',
    name: 'Call Resend API',
    description:
      'Make a generic API call to Resend. This is a flexible template that can be used to call any Resend API endpoint by specifying the method, URL, and request body.',
    tags: ['resend', 'email', 'api', 'call', 'generic'],
    secret: '@resend',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Resend API endpoint to call',
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
