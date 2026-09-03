import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'abstractapi/phone/validate': createFetchTemplate({
    provider: 'abstractapi',
    icon: '@logo/abstractapi.com',
    name: 'Validate Phone Number',
    description:
      'Verify phone number validity and get carrier information, number type, and formatting details',
    tags: ['abstractapi', 'phone', 'validation'],
    secret: '@abstractapi',
    instruction: {
      method: 'GET',
      url: 'https://phonevalidation.abstractapi.com',
      path: ['/v1'],
      query: {
        api_key: secret(),
        phone: field({
          name: 'phoneNumber',
          description: 'the phone number to validate (E.164 format preferred)',
        }),
      },
    },
  }),
}

export default abilities
