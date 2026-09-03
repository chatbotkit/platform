import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'mailgun/email/send': createFetchTemplate({
    provider: 'mailgun',
    icon: '@logo/mailgun.com',
    name: 'Send Email with Mailgun',
    description:
      'Send an email using Mailgun with support for HTML content, attachments, and advanced options',
    tags: ['mailgun', 'email', 'send', 'communication'],
    secret: '@mailgun',
    instruction: {
      method: 'POST',
      url: 'https://api.mailgun.net',
      path: [
        '/v3/',
        field({
          name: 'domain',
          description: 'the domain name to send from',
          placeholder: true,
        }),
        '/messages',
      ],
      headers: {
        Authorization: secret(),
      },
      body: {
        from: field({ name: 'from', description: 'sender email address' }),
        to: field({ name: 'to', description: 'recipient email address' }),
        subject: field({ name: 'subject', description: 'email subject' }),
        text: field({
          name: 'text',
          description: 'email body in plain text',
          optional: true,
        }),
        html: field({
          name: 'html',
          description: 'email body in HTML format',
          optional: true,
        }),
      },
    },
  }),

  'mailgun/domain/list': createFetchTemplate({
    provider: 'mailgun',
    icon: '@logo/mailgun.com',
    name: 'List Mailgun Domains',
    description: 'List all domains configured in your Mailgun account',
    tags: ['mailgun', 'domain', 'list'],
    secret: '@mailgun',
    instruction: {
      method: 'GET',
      url: 'https://api.mailgun.net/v4/domains',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of domains to return',
          optional: true,
          default: 100,
        }),
      },
    },
  }),

  'mailgun/suppressions/list': createFetchTemplate({
    provider: 'mailgun',
    icon: '@logo/mailgun.com',
    name: 'List Email Suppressions',
    description:
      'List email addresses that have been suppressed due to bounces, complaints, or unsubscribes',
    tags: ['mailgun', 'suppressions', 'bounces', 'unsubscribes'],
    secret: '@mailgun',
    instruction: {
      method: 'GET',
      url: 'https://api.mailgun.net',
      path: [
        '/v3/',
        field({
          name: 'domain',
          description: 'the domain name to check suppressions for',
          placeholder: true,
        }),
        '/bounces',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of suppressions to return',
          optional: true,
          default: 100,
        }),
      },
    },
  }),

  'mailgun/stats/fetch': createFetchTemplate({
    provider: 'mailgun',
    icon: '@logo/mailgun.com',
    name: 'Get Email Stats',
    description:
      'Get email sending statistics for a domain including delivered, failed, and opened counts',
    tags: ['mailgun', 'stats', 'analytics', 'metrics'],
    secret: '@mailgun',
    instruction: {
      method: 'GET',
      url: 'https://api.mailgun.net',
      path: [
        '/v3/',
        field({
          name: 'domain',
          description: 'the domain name to get stats for',
          placeholder: true,
        }),
        '/stats/total',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        event: field({
          name: 'event',
          description: 'event type to filter by',
          enum: ['accepted', 'delivered', 'failed', 'opened', 'clicked'],
          optional: true,
        }),
        duration: field({
          name: 'duration',
          description: 'time period for stats',
          optional: true,
          default: '1d',
        }),
      },
    },
  }),
}

export default abilities
