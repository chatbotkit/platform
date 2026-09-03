import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'abstractapi/email/validate': createFetchTemplate({
    provider: 'abstractapi',
    icon: '@logo/abstractapi.com',
    name: 'Validate Email Address',
    description:
      'Verify email deliverability and quality including format validation, domain checks, and disposable email detection',
    tags: ['abstractapi', 'email', 'validation'],
    secret: '@abstractapi',
    instruction: {
      method: 'GET',
      url: 'https://emailvalidation.abstractapi.com',
      path: ['/v1'],
      query: {
        api_key: secret(),
        email: field({
          name: 'email',
          description: 'the email address to validate',
        }),
        auto_correct: field({
          name: 'autoCorrect',
          type: 'boolean',
          optional: true,
          default: true,
          description: 'attempt to auto-correct typos in the email address',
        }),
      },
    },
  }),
}

export default abilities
