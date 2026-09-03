import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'mailgun/email/verify': createFetchTemplate({
    provider: 'mailgun',
    icon: '@logo/mailgun.com',
    name: 'Verify Email Address',
    description:
      'Verify email address deliverability and quality using Mailgun validation service',
    tags: ['mailgun', 'email', 'verify', 'validation'],
    secret: '@mailgun',
    instruction: {
      method: 'GET',
      url: 'https://api.mailgun.net/v4/address/validate',
      headers: {
        Authorization: secret(),
      },
      query: {
        address: field({
          name: 'email',
          description: 'email address to verify',
        }),
      },
    },
  }),
}

export default abilities
